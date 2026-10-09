"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { BlogEditor } from "@/components/blog/blog-editor";
import { Comments } from "@/components/collab/comments";
import { RichContent } from "@/components/content/rich-content";
import { FileList } from "@/components/files/file-list";
import { Button } from "@/components/ui/button";
import { useSupports } from "@/hooks/use-supports";
import { formatDistanceToNow } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { BlogEntry } from "@/types/blog";

const STATE_LABEL = { draft: "Draft · only you", site: "", public: "Public" } as const;

export function BlogEntryCard({ entry, onTag, onChanged }: { entry: BlogEntry; onTag: (tag: string) => void; onChanged: () => void }) {
	const { client } = useMoodleConnection();
	const canUpdate = useSupports("core_blog_update_entry");
	const canRemove = useSupports("core_blog_delete_entry");
	const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");

	async function remove() {
		try {
			await client?.deleteBlogEntry(entry.id);
			toast.success("Entry deleted");
			onChanged();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't delete that entry.");
			setMode("view");
		}
	}

	if (mode === "edit") {
		return (
			<BlogEditor
				entry={entry}
				submitLabel="Save entry"
				onCancel={() => setMode("view")}
				onSubmit={async (input) => {
					await client?.updateBlogEntry(entry.id, input);
					setMode("view");
					toast.success("Entry saved");
					onChanged();
				}}
			/>
		);
	}
	const when = entry.modified ?? entry.created;
	return (
		<article className="flex flex-col gap-2 rounded-xl border bg-card p-5">
			<h2 className="text-xl">{entry.subject}</h2>
			<p className="text-xs text-muted-foreground">
				{entry.canEdit ? "You" : entry.author}
				{when && ` · ${formatDistanceToNow(when)}`}
				{STATE_LABEL[entry.publishState] && ` · ${STATE_LABEL[entry.publishState]}`}
			</p>
			<RichContent html={entry.html} />
			{entry.attachments.length > 0 && <FileList files={entry.attachments} />}
			{entry.tags.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{entry.tags.map((t) => (
						<button key={t} type="button" onClick={() => onTag(t)} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2">
							#{t}
						</button>
					))}
				</div>
			)}
			{entry.canEdit && (canUpdate || canRemove) && (
				<footer className="flex items-center gap-1">
					{canUpdate && (
						<Button variant="ghost" size="xs" onClick={() => setMode("edit")}>
							<Pencil aria-hidden="true" />
							Edit
						</Button>
					)}
					{canRemove && mode === "view" && (
						<Button variant="ghost" size="xs" onClick={() => setMode("confirm-delete")}>
							<Trash2 aria-hidden="true" />
							Delete
						</Button>
					)}
					{mode === "confirm-delete" && (
						<>
							<Button variant="destructive" size="xs" onClick={() => void remove()}>
								Delete entry
							</Button>
							<Button variant="ghost" size="xs" onClick={() => setMode("view")}>
								Keep
							</Button>
						</>
					)}
				</footer>
			)}
			<Comments target={{ contextLevel: "system", instanceId: 0, component: "blog", area: "format_blog", itemId: entry.id }} />
		</article>
	);
}
