"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { parseTags } from "@/lib/moodle/normalize-blog";
import { toast } from "@/lib/toast";
import type { BlogEntry, BlogInput, BlogPublishState } from "@/types/blog";

const plain = (html: string) => html.replace(/<[^>]*>/g, "").trim();

/** Subject, rich text, tags and who may read it. */
export function BlogEditor({ entry, submitLabel, onSubmit, onCancel }: { entry?: BlogEntry; submitLabel: string; onSubmit: (input: BlogInput) => Promise<void>; onCancel: () => void }) {
	const [subject, setSubject] = useState(entry?.subject ?? "");
	const [html, setHtml] = useState(entry?.html ?? "");
	const [tags, setTags] = useState(entry?.tags.join(", ") ?? "");
	// ponytail: "public" (readable without login) is only offered when an existing entry already has it
	const [publishState, setPublishState] = useState<BlogPublishState>(entry?.publishState ?? "site");
	const [busy, setBusy] = useState(false);

	async function submit() {
		if (busy || !subject.trim() || !plain(html)) return;
		setBusy(true);
		try {
			await onSubmit({ subject: subject.trim(), html, tags: parseTags(tags), publishState });
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't save the entry.");
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
			<Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Title" aria-label="Title" maxLength={128} required />
			<RichTextEditor initialHtml={entry?.html ?? ""} onChange={setHtml} placeholder="Write your entry…" minRows={8} label="Entry" onSubmitShortcut={() => void submit()} />
			<Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, separated by commas" aria-label="Tags" />
			<label className="flex items-center gap-2 text-sm">
				Visible to
				<select value={publishState} onChange={(e) => setPublishState(e.target.value as BlogPublishState)} className="h-9 rounded-lg border bg-card px-2">
					<option value="draft">Only me (draft)</option>
					<option value="site">Everyone on this site</option>
					{(entry?.publishState === "public" || publishState === "public") && <option value="public">Everyone on the internet</option>}
				</select>
			</label>
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
					Cancel
				</Button>
				<Button type="submit" disabled={busy || !subject.trim() || !plain(html)}>
					{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}
