"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RichContent } from "@/components/content/rich-content";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { formatDistanceToNow } from "@/lib/format";
import type { MoodleAssignment } from "@/types/moodle";

export function SubmissionComments({ assignment }: { assignment: MoodleAssignment }) {
	const { client } = useMoodleConnection();
	const [reloadKey, setReloadKey] = useState(0);
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const comments = useMoodleQuery(client ? () => client.getSubmissionComments(assignment) : null, [
		client,
		assignment.id,
		assignment.submission?.id,
		reloadKey,
	]);

	async function post() {
		if (!client || !text.trim() || busy) return;
		setBusy(true);
		try {
			await client.addSubmissionComment(assignment, text.trim());
			setText("");
			setReloadKey((k) => k + 1);
		} catch {
			toast.error("Couldn't post the comment.");
		} finally {
			setBusy(false);
		}
	}

	const list = comments.data ?? [];
	return (
		<Collapsible>
			<CollapsibleTrigger className="group/comments flex items-center gap-1 text-sm text-primary outline-none hover:underline focus-visible:underline">
				<ChevronRight className="size-3.5 transition-transform group-data-panel-open/comments:rotate-90" aria-hidden="true" />
				Comments ({comments.loading ? "…" : list.length})
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="mt-3 flex flex-col gap-3">
					{list.map((c) => (
						<div key={c.id} className="rounded-lg border bg-background/50 p-3">
							<p className="text-xs text-muted-foreground">
								<span className="font-medium text-foreground">{c.author}</span> · {formatDistanceToNow(c.time)}
							</p>
							<RichContent html={c.content} />
						</div>
					))}
					<div className="flex flex-col gap-2">
						<Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" rows={2} />
						<Button size="sm" className="w-fit" onClick={post} disabled={busy || !text.trim()}>
							{busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
							Post comment
						</Button>
					</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
