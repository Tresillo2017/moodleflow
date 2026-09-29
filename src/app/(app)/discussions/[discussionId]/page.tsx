"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, MessageSquareOff } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useForum } from "@/hooks/use-forum";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { ForumPostView } from "@/components/forums/forum-post";
import { DiscussionToggles } from "@/components/forums/discussion-toggles";
import { FORUM_PAGE_SIZE } from "@/lib/moodle/client-social";
import { threadOrder } from "@/lib/moodle/normalize-forum";
import type { MoodleForumDiscussion } from "@/types/moodle";

/** Pages of the forum list searched for this discussion's flags (locked, pinned, ...). */
const MAX_FLAG_PAGES = 10;

function DiscussionContent({ discussionId }: { discussionId: number }) {
	const { client, refresh } = useMoodleConnection();
	const [version, setVersion] = useState(0);
	const thread = useMoodleQuery(client ? () => client.getForumThread(discussionId) : null, [client, discussionId, version]);
	const forum = useForum(thread.data?.forumId ?? 0, thread.data?.courseId || null);
	const [state, setState] = useState<MoodleForumDiscussion | null>(null);

	// discussion flags (locked, subscribed, …) live on the forum's discussion list, not on the thread
	const forumId = thread.data?.forumId;
	const flags = useMoodleQuery(
		client && forumId
			? async () => {
					for (let page = 0; page < MAX_FLAG_PAGES; page++) {
						const list = await client.getForumDiscussions(forumId, page);
						const found = list.find((d) => d.id === discussionId);
						if (found || list.length < FORUM_PAGE_SIZE) return found ?? null;
					}
					return null;
				}
			: null,
		[client, forumId, discussionId],
	);
	const summary = state ?? flags.data ?? null;

	const nodes = useMemo(() => threadOrder(thread.data?.posts ?? []), [thread.data]);
	const root = nodes[0]?.post;

	useEffect(() => {
		if (!client || !root) return;
		void client.viewDiscussion(discussionId);
	}, [client, root, discussionId]);

	const locked = summary?.locked ?? false;
	return (
		<div className="flex flex-col gap-6">
			<Link
				href={forumId ? `/forums/${forumId}?course=${thread.data?.courseId ?? ""}` : "/courses"}
				className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				{forum.data?.name ?? "Back to forum"}
			</Link>
			<PageHeader
				title={root?.subject ?? "Discussion"}
				description={locked ? <span className="flex items-center gap-1"><Lock className="size-3.5" aria-hidden="true" /> Replies are locked</span> : undefined}
				actions={summary && forumId ? <DiscussionToggles discussion={summary} forumId={forumId} onChange={setState} /> : undefined}
			/>
			{thread.loading && <ListSkeleton rows={3} />}
			{thread.error && <ErrorState error={thread.error} onRetry={refresh} />}
			{thread.data && nodes.length === 0 && <EmptyState icon={MessageSquareOff} title="Nothing to show" description="This discussion has no visible posts." />}
			<div className="flex flex-col gap-3">
				{nodes.map(({ post, depth }) => (
					<ForumPostView key={post.id} post={post} depth={depth} forum={forum.data ?? undefined} discussionLocked={locked} onChanged={() => setVersion((v) => v + 1)} />
				))}
			</div>
		</div>
	);
}

export default function DiscussionPage({ params }: { params: Promise<{ discussionId: string }> }) {
	const { discussionId } = use(params);
	return (
		<FeatureGate feature="Forums" functions={["mod_forum_get_discussion_posts"]}>
			<DiscussionContent discussionId={Number(discussionId)} />
		</FeatureGate>
	);
}
