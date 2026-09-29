"use client";

import { useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { toast } from "@/lib/toast";
import type { ForumPostInput } from "@/types/moodle";

interface PostEditorProps {
	initialSubject?: string;
	initialMessage?: string;
	submitLabel: string;
	/** Discussions and edits carry a subject; replies keep "Re: …". */
	showSubject?: boolean;
	/** 0 hides the attachment picker (edits can't change attachments here). */
	maxAttachments?: number;
	maxBytes?: number;
	onSubmit: (input: ForumPostInput) => Promise<void>;
	onCancel?: () => void;
}

const plain = (html: string) => html.replace(/<[^>]*>/g, "").trim();

/** Subject + rich text + attachments, shared by new discussions, replies and edits. */
export function PostEditor({ initialSubject = "", initialMessage = "", submitLabel, showSubject = true, maxAttachments = 0, maxBytes, onSubmit, onCancel }: PostEditorProps) {
	const [subject, setSubject] = useState(initialSubject);
	const [message, setMessage] = useState(initialMessage);
	const [files, setFiles] = useState<File[]>([]);
	const [busy, setBusy] = useState(false);

	function addFiles(picked: FileList | null) {
		const next = [...files, ...Array.from(picked ?? [])];
		if (next.length > maxAttachments) return toast.error(`You can attach up to ${maxAttachments} files.`);
		const tooBig = maxBytes ? next.find((f) => f.size > maxBytes) : undefined;
		if (tooBig) return toast.error(`${tooBig.name} is larger than the ${Math.round((maxBytes ?? 0) / 1_048_576)} MB limit.`);
		setFiles(next);
	}

	async function submit() {
		if (busy || !plain(message) || (showSubject && !subject.trim())) return;
		setBusy(true);
		try {
			await onSubmit({ subject: subject.trim(), message, files });
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't post that. Try again.");
			setBusy(false);
		}
	}

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
		>
			{showSubject && <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" maxLength={255} required />}
			<RichTextEditor initialHtml={initialMessage} onChange={setMessage} placeholder="Write your message…" minRows={5} label="Message" onSubmitShortcut={() => void submit()} />
			{maxAttachments > 0 && (
				<div className="flex flex-col gap-2">
					{files.length > 0 && (
						<ul className="flex flex-wrap gap-2">
							{files.map((f, i) => (
								<li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
									<span className="max-w-40 truncate">{f.name}</span>
									<button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
										<X className="size-3" aria-hidden="true" />
									</button>
								</li>
							))}
						</ul>
					)}
					{files.length < maxAttachments && (
						<label className="flex w-fit cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
							<Paperclip className="size-3.5" aria-hidden="true" />
							Attach files
							<input type="file" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
						</label>
					)}
				</div>
			)}
			<div className="flex gap-2">
				<Button type="submit" size="sm" disabled={busy || !plain(message) || (showSubject && !subject.trim())}>
					{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
					{submitLabel}
				</Button>
				{onCancel && (
					<Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
						Cancel
					</Button>
				)}
			</div>
		</form>
	);
}
