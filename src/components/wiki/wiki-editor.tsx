"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { toast } from "@/lib/toast";

const plain = (html: string) => html.replace(/<[^>]*>/g, "").trim();

/** Title (new pages only) + rich text for a wiki page. */
export function WikiEditor({
	initialTitle,
	initialHtml = "",
	submitLabel,
	onSubmit,
	onCancel,
}: {
	/** Omit to keep the title fixed (editing an existing page). */
	initialTitle?: string;
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
			{initialTitle !== undefined && <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" aria-label="Page title" maxLength={255} required />}
			<RichTextEditor initialHtml={initialHtml} onChange={setHtml} placeholder="Write the page…" minRows={10} label="Page content" onSubmitShortcut={() => void submit()} />
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
