"use client";

import { useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { toast } from "@/lib/toast";
import { MoodleError, type MoodleFile } from "@/types/moodle";
import type { Workshop, WorkshopSubmission } from "@/types/workshop";

type Attachment = File | MoodleFile;

const plain = (html: string) => html.replace(/<[^>]*>/g, "").trim();
const megabytes = (bytes: number) => Math.round(bytes / 1_048_576);

function validateFiles(files: Attachment[], workshop: Workshop): string | null {
	if (files.length > workshop.maxAttachments) return `At most ${workshop.maxAttachments} files are allowed.`;
	const tooBig = workshop.maxBytes ? files.find((f) => f.size > (workshop.maxBytes ?? 0)) : undefined;
	return tooBig ? `${tooBig.name} is larger than ${megabytes(workshop.maxBytes ?? 0)} MB.` : null;
}

interface SubmissionDialogProps {
	workshop: Workshop;
	/** The submission being edited; omit to create one. */
	existing?: WorkshopSubmission;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => void;
}

export function SubmissionDialog({ workshop, existing, open, onOpenChange, onSaved }: SubmissionDialogProps) {
	// remount per open so the form starts from the current submission
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">{open && <SubmissionForm workshop={workshop} existing={existing} onClose={() => onOpenChange(false)} onSaved={onSaved} />}</DialogContent>
		</Dialog>
	);
}

function SubmissionForm({ workshop, existing, onClose, onSaved }: { workshop: Workshop; existing?: WorkshopSubmission; onClose: () => void; onSaved: () => void }) {
	const { client } = useMoodleConnection();
	const [title, setTitle] = useState(existing?.title ?? "");
	const [content, setContent] = useState(existing?.content ?? "");
	const [files, setFiles] = useState<Attachment[]>(existing?.files ?? []);
	const [busy, setBusy] = useState(false);

	const usesText = workshop.text !== "off";
	const usesFiles = workshop.files !== "off" && workshop.maxAttachments > 0;
	const fileError = validateFiles(files, workshop);
	const missing =
		!title.trim() ||
		(!plain(content) && files.length === 0) ||
		(workshop.text === "required" && !plain(content)) ||
		(workshop.files === "required" && files.length === 0);
	const disabled = busy || missing || Boolean(fileError);

	// kept files live on Moodle: read them back so they're re-uploaded into the new draft area
	async function toFile(f: Attachment): Promise<File> {
		if (f instanceof File) return f;
		const res = await fetch(client?.fileUrl(f.url, { download: false }) ?? f.url);
		if (!res.ok) throw new MoodleError("network_error", `Couldn't read existing file ${f.name}.`);
		return new File([await res.blob()], f.name, { type: f.mimeType });
	}

	async function save() {
		if (!client || disabled) return;
		setBusy(true);
		try {
			await client.saveWorkshopSubmission(workshop.id, { title: title.trim(), content: usesText ? content : "", files: await Promise.all(files.map(toFile)) }, existing?.id);
			toast.success(existing ? "Submission updated" : "Submission saved");
			onSaved();
			onClose();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't save your submission. Try again.");
			setBusy(false);
		}
	}

	return (
		<>
			<DialogHeader>
				<DialogTitle>{existing ? "Edit your submission" : "Add your submission"}</DialogTitle>
				<DialogDescription>{workshop.name}</DialogDescription>
			</DialogHeader>
			<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" maxLength={255} required />
			{usesText && <RichTextEditor initialHtml={content} onChange={setContent} placeholder="Write your submission…" minRows={usesFiles ? 5 : 8} label="Submission text" />}
			{usesFiles && (
				<div className="flex flex-col gap-2">
					{files.length > 0 && (
						<ul className="flex flex-col gap-1">
							{files.map((f, i) => (
								<li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
									<FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
									<span className="flex-1 truncate">{f.name}</span>
									<span className="text-muted-foreground tabular-nums">{Math.round(f.size / 1024)} KB</span>
									<button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Remove ${f.name}`}>
										<X className="size-3.5" aria-hidden="true" />
									</button>
								</li>
							))}
						</ul>
					)}
					{files.length < workshop.maxAttachments && (
						<label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring">
							<Paperclip className="size-3.5" aria-hidden="true" />
							Add files{workshop.files === "required" ? " (required)" : ""}
							<input type="file" multiple className="sr-only" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
						</label>
					)}
					{fileError && <p role="alert" className="text-xs text-danger">{fileError}</p>}
				</div>
			)}
			<DialogFooter>
				<Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
				<Button onClick={() => void save()} disabled={disabled}>
					{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
					{existing ? "Save changes" : "Submit"}
				</Button>
			</DialogFooter>
		</>
	);
}
