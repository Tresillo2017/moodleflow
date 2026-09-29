"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { FileText, Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { celebrate } from "@/lib/confetti";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import type { MoodleAssignment, MoodleFile } from "@/types/moodle";

type Attachment = File | MoodleFile;

function htmlToText(html: string): string {
	return new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
}

const sizeOf = (f: Attachment) => f.size;
const nameOf = (f: Attachment) => f.name;

function validateFiles(files: Attachment[], assignment: MoodleAssignment): string | null {
	const { maxFiles, maxFileBytes } = assignment.config ?? {};
	if (maxFiles && files.length > maxFiles) return `At most ${maxFiles} files are allowed.`;
	const tooBig = maxFileBytes ? files.find((f) => sizeOf(f) > maxFileBytes) : undefined;
	if (tooBig) return `${nameOf(tooBig)} is larger than ${Math.round((maxFileBytes ?? 0) / 1_048_576)} MB.`;
	return null;
}

interface SubmitDialogProps {
	assignment: MoodleAssignment;
	onSubmitted?: () => void;
	/** Files dropped on the page: opens the dialog with them attached. */
	droppedFiles?: File[] | null;
	onDroppedHandled?: () => void;
}

export function SubmitDialog({ assignment, onSubmitted, droppedFiles, onDroppedHandled }: SubmitDialogProps) {
	const { client } = useMoodleConnection();
	const config = assignment.config;
	const acceptsText = config?.acceptsText ?? true;
	const acceptsFiles = config?.acceptsFiles ?? false;
	const draftMode = config?.requiresSubmitAction ?? false;
	const existing = assignment.submission;
	const editing = Boolean(existing && existing.status !== "new");

	const [open, setOpen] = useState(false);
	const [progress, setProgress] = useState<number | null>(null);
	const [text, setText] = useState("");
	const [editorKey, setEditorKey] = useState(0);
	const [files, setFiles] = useState<Attachment[]>([]);
	const [statement, setStatement] = useState(false);
	const [busy, setBusy] = useState(false);

	function handleOpenChange(next: boolean) {
		if (next) {
			setText(existing?.text ?? "");
			setEditorKey((k) => k + 1);
			setFiles(existing?.files ?? []);
			setStatement(false);
		}
		setOpen(next);
	}

	useEffect(() => {
		if (!droppedFiles?.length) return;
		setText(existing?.text ?? "");
		setEditorKey((k) => k + 1);
		setFiles([...(existing?.files ?? []), ...droppedFiles]);
		setStatement(false);
		setOpen(true);
		onDroppedHandled?.();
	}, [droppedFiles, existing, onDroppedHandled]);

	const plainText = htmlToText(text).trim();
	const hasContent = plainText.length > 0 || files.length > 0;
	const fileError = validateFiles(files, assignment);
	const needsStatement = draftMode && Boolean(config?.requiresStatement);
	const wordCount = plainText ? plainText.split(/\s+/).length : 0;

	async function save(finalize: boolean) {
		if (!client || !hasContent || busy || fileError) return;
		setBusy(true);
		try {
			await client.saveAssignmentSubmission(assignment, {
				...(acceptsText ? { text } : {}),
				...(acceptsFiles ? { files } : {}),
				onProgress: setProgress,
			});
			if (finalize) await client.submitAssignmentForGrading(assignment.id);
			const submitted = finalize || !draftMode;
			toast.success(submitted ? "Submission sent" : "Draft saved");
			if (submitted) void celebrate();
			setOpen(false);
			onSubmitted?.();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't submit. Check your connection and try again.");
		} finally {
			setBusy(false);
			setProgress(null);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={
					<Button size="sm" variant="outline">
						<Send className="size-3.5" aria-hidden="true" />
						{editing ? "Edit submission" : "Submit"}
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{assignment.name}</DialogTitle>
					<DialogDescription>
						{[acceptsText && "an online text response", acceptsFiles && "files"].filter(Boolean).join(" and ") || "your work"}
						{draftMode ? " — saved as a draft until you submit it for grading." : "."}
					</DialogDescription>
				</DialogHeader>

				{acceptsText && (
					<RichTextEditor
						key={editorKey}
						initialHtml={text}
						onChange={setText}
						placeholder="Write your submission…"
						minRows={acceptsFiles ? 5 : 8}
						onSubmitShortcut={() => (!needsStatement || statement) && save(draftMode)}
					/>
				)}

				{acceptsFiles && (
					<div className="flex flex-col gap-2">
						<ul className="flex flex-col gap-1">
							{files.map((f, i) => (
								<li key={`${nameOf(f)}-${i}`} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
									<FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
									<span className="flex-1 truncate">{nameOf(f)}</span>
									<span className="text-muted-foreground tabular-nums">{Math.round(sizeOf(f) / 1024)} KB</span>
									<button
										type="button"
										onClick={() => setFiles(files.filter((_, j) => j !== i))}
										className="rounded p-0.5 text-muted-foreground hover:text-foreground"
										aria-label={`Remove ${nameOf(f)}`}
									>
										<X className="size-3.5" />
									</button>
								</li>
							))}
						</ul>
						<label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring">
							<Paperclip className="size-3.5" aria-hidden="true" />
							Add files
							<input
								type="file"
								multiple
								className="sr-only"
								onChange={(e) => {
									setFiles([...files, ...Array.from(e.target.files ?? [])]);
									e.target.value = "";
								}}
							/>
						</label>
						{fileError && <p role="alert" className="text-xs text-danger">{fileError}</p>}
					</div>
				)}

				{needsStatement && (
					<label className="flex items-start gap-2 text-xs text-muted-foreground">
						<input type="checkbox" checked={statement} onChange={(e) => setStatement(e.target.checked)} className="mt-0.5" />
						This assignment is my own work, except where I have acknowledged the use of the works of other people.
					</label>
				)}

				<DialogFooter className="items-center sm:justify-between">
					<p className="text-xs text-muted-foreground tabular-nums">
						{acceptsText ? `${wordCount} ${wordCount === 1 ? "word" : "words"} · ⌘↵ to submit` : `${files.length} file${files.length === 1 ? "" : "s"}`}
					</p>
					<div className="flex gap-2">
						{draftMode && (
							<Button variant="outline" onClick={() => save(false)} disabled={busy || !hasContent || Boolean(fileError)}>
								Save draft
							</Button>
						)}
						<Button
							onClick={() => save(draftMode)}
							disabled={busy || !hasContent || Boolean(fileError) || (needsStatement && !statement)}
						>
							{busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
							{busy && progress !== null && progress < 1
								? `Uploading ${Math.round(progress * 100)}%`
								: draftMode ? "Submit for grading" : editing ? "Save changes" : "Submit assignment"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
