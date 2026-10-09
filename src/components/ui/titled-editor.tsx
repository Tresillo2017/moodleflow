"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { toast } from "@/lib/toast";

const plain = (html: string) => html.replace(/<[^>]*>/g, "").trim();

/** Optional title + rich text, shared by wiki pages, glossary entries and blog entries. */
export function TitledEditor({
	initialTitle,
	initialHtml = "",
	titleLabel = "Title",
	contentLabel = "Content",
	submitLabel,
	onSubmit,
	onCancel,
}: {
	/** Omit to hide the title field (editing an existing wiki page). */
	initialTitle?: string;
	titleLabel?: string;
	contentLabel?: string;
	initialHtml?: string;
	submitLabel: string;
	onSubmit: (title: string, html: string) => Promise<void>;
	onCancel: () => void;
}) {
	const [title, setTitle] = useState(initialTitle ?? "");
	const [html, setHtml] = useState(initialHtml);
	const [busy, setBusy] = useState(false);

	async function submit() {
		if (busy || (initialTitle !== undefined && !title.trim())) return;
		setBusy(true);
		try {
			await onSubmit(title.trim(), html);
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't save that. Try again.");
			setBusy(false);
		}
	}

	return (
		<form
			className="flex flex-col gap-3 rounded-xl border bg-card p-5"
			onSubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
		>
			{initialTitle !== undefined && <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={titleLabel} aria-label={titleLabel} maxLength={255} required />}
			<RichTextEditor initialHtml={initialHtml} onChange={setHtml} placeholder="Write something…" minRows={10} label={contentLabel} onSubmitShortcut={() => void submit()} />
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
					Cancel
				</Button>
				<Button type="submit" disabled={busy || (initialTitle !== undefined && !title.trim()) || (initialTitle === undefined && !plain(html))}>
					{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}
