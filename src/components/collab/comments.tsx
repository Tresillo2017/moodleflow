"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Send, Trash2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { RichContent } from "@/components/content/rich-content";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useSupports } from "@/hooks/use-supports";
import { formatDistanceToNow } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { CommentTarget } from "@/types/collab";

/** Moodle's comment thread for any item: read, post, and delete what you're allowed to. Renders nothing when the site has comments off. */
export function Comments({ target }: { target: CommentTarget }) {
	const { client } = useMoodleConnection();
	const supported = useSupports("core_comment_get_comments");
	const [reloadKey, setReloadKey] = useState(0);
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const key = `${target.component}/${target.area}/${target.itemId}`;
	const thread = useMoodleQuery(client && supported ? () => client.getComments(target) : null, [client, supported, key, reloadKey]);

	if (!supported || thread.error) return null; // disabled for this item or not permitted
	const list = thread.data?.comments ?? [];

	async function run(action: () => Promise<void>, failed: string) {
		setBusy(true);
		try {
			await action();
			setReloadKey((k) => k + 1);
		} catch {
			toast.error(failed);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Collapsible>
			<CollapsibleTrigger className="group/comments flex items-center gap-1 text-xs text-primary outline-none hover:underline focus-visible:underline">
				<ChevronRight className="size-3.5 transition-transform group-data-panel-open/comments:rotate-90" aria-hidden="true" />
				Comments ({thread.loading ? "…" : list.length})
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="mt-3 flex flex-col gap-3">
					{list.map((c) => (
						<div key={c.id} className="rounded-lg border bg-background/50 p-3">
							<p className="flex items-center gap-1 text-xs text-muted-foreground">
								<span className="font-medium text-foreground">{c.author}</span> · {formatDistanceToNow(c.time)}
								{c.canDelete && (
									<button
										type="button"
										aria-label="Delete comment"
										disabled={busy}
										onClick={() => void run(() => client!.deleteComment(c.id), "Couldn't delete the comment.")}
										className="ml-auto text-muted-foreground hover:text-destructive focus-visible:outline-2"
									>
										<Trash2 className="size-3.5" aria-hidden="true" />
									</button>
								)}
							</p>
							<RichContent html={c.content} />
						</div>
					))}
					{thread.data?.canPost && (
						<form
							className="flex flex-col gap-2"
							onSubmit={(e) => {
								e.preventDefault();
								if (!client || !text.trim() || busy) return;
								void run(async () => {
									await client.addComment(target, text.trim());
									setText("");
								}, "Couldn't post the comment.");
							}}
						>
							<Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" aria-label="Add a comment" rows={2} />
							<Button type="submit" size="sm" className="w-fit" disabled={busy || !text.trim()}>
								{busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
								Post comment
							</Button>
						</form>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
