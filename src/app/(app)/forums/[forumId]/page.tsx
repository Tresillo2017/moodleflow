"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, MessageSquare, MessageSquarePlus, Pin, Lock } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useForum } from "@/hooks/use-forum";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichContent } from "@/components/content/rich-content";
import { PersonAvatar } from "@/components/people/person-avatar";
import { DiscussionToggles } from "@/components/forums/discussion-toggles";
import { PostEditor } from "@/components/forums/post-editor";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { FORUM_PAGE_SIZE } from "@/lib/moodle/client-social";
import { formatDistanceToNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MoodleForumDiscussion } from "@/types/moodle";

function ForumContent({ forumId }: { forumId: number }) {
	const { client, refresh } = useMoodleConnection();
	const courseParam = Number(useSearchParams().get("course")) || null;
	const forum = useForum(forumId, courseParam);
	useEffect(() => {
		void client?.logActivityView({ type: "forum", instance: forumId });
	}, [client, forumId]);
	const first = useMoodleQuery(client ? () => client.getForumDiscussions(forumId, 0) : null, [client, forumId]);
	const [more, setMore] = useState<MoodleForumDiscussion[]>([]);
	const [page, setPage] = useState(0);
	const [exhausted, setExhausted] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [edits, setEdits] = useState<Map<number, MoodleForumDiscussion>>(new Map());
	const [composing, setComposing] = useState(false);

	const all = [...(first.data ?? []), ...more].map((d) => edits.get(d.id) ?? d);
	// pinned first (Moodle sorts each page, but a later page can hold a pin)
	const discussions = [...all.filter((d) => d.pinned), ...all.filter((d) => !d.pinned)];
	const hasMore = !exhausted && (first.data?.length ?? 0) >= FORUM_PAGE_SIZE && all.length === (page + 1) * FORUM_PAGE_SIZE;

	async function loadMore() {
		if (!client) return;
		setLoadingMore(true);
		try {
			const next = await client.getForumDiscussions(forumId, page + 1);
			setMore((m) => [...m, ...next]);
			setPage(page + 1);
			if (next.length < FORUM_PAGE_SIZE) setExhausted(true);
		} finally {
			setLoadingMore(false);
		}
	}

	const f = forum.data;
	// a "single simple discussion" forum is just its one discussion
	const only = f?.type === "single" && discussions.length === 1 ? discussions[0] : null;

	return (
		<div className="flex flex-col gap-6">
			<Link href={courseParam ?? f?.courseId ? `/courses/${courseParam ?? f?.courseId}` : "/courses"} className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				Back to course
			</Link>
			<PageHeader
				title={f?.name ?? "Forum"}
				description={f?.type === "qanda" ? "Q&A forum: post before you can see others' replies." : undefined}
				actions={
					f?.canCreateDiscussions && f.type !== "single" && (
						<Button size="sm" onClick={() => setComposing(true)}>
							<MessageSquarePlus aria-hidden="true" />
							New discussion
						</Button>
					)
				}
			/>
			{f?.intro && <RichContent html={f.intro} className="rounded-xl border bg-card p-4" />}

			{(first.loading || forum.loading) && <ListSkeleton rows={4} />}
			{first.error && <ErrorState error={first.error} onRetry={refresh} />}
			{only && (
				<Button nativeButton={false} render={<Link href={`/discussions/${only.id}`} />} className="w-fit">
					Open discussion
				</Button>
			)}
			{first.data && discussions.length === 0 && <EmptyState icon={MessageSquare} title="No discussions yet" description={f?.canCreateDiscussions ? "Start the first one." : "Nothing has been posted here."} />}
			{discussions.length > 0 && !only && (
				<ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
					{discussions.map((d) => (
						<li key={d.id} className={cn("flex items-center gap-3 px-4 py-3 text-sm", d.unread > 0 && "bg-accent/30")}>
							<PersonAvatar name={d.author} imageUrl={d.authorImageUrl} size="sm" />
							<Link href={`/discussions/${d.id}`} className="min-w-0 flex-1 outline-none focus-visible:underline">
								<p className="flex items-center gap-1.5">
									{d.pinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pinned" />}
									{d.locked && <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />}
									<span className={cn("truncate", d.unread > 0 ? "font-semibold" : "font-medium")}>{d.subject}</span>
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{d.author} · {formatDistanceToNow(d.timeModified)}
								</p>
							</Link>
							<span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
								{d.replies} {d.replies === 1 ? "reply" : "replies"}
								{d.unread > 0 && <span className="ml-1 text-primary">· {d.unread} new</span>}
							</span>
							<DiscussionToggles discussion={d} forumId={forumId} onChange={(next) => setEdits((m) => new Map(m).set(next.id, next))} />
						</li>
					))}
				</ul>
			)}
			{hasMore && (
				<Button variant="outline" className="w-fit self-center" onClick={loadMore} disabled={loadingMore}>
					{loadingMore && <Loader2 className="animate-spin" aria-hidden="true" />}
					Load more
				</Button>
			)}

			{composing && f && (
				<Dialog open onOpenChange={(open: boolean) => !open && setComposing(false)}>
					<DialogContent className="max-w-2xl sm:max-w-2xl">
						<DialogHeader>
							<DialogTitle>New discussion</DialogTitle>
						</DialogHeader>
						<PostEditor
							submitLabel="Post to forum"
							maxAttachments={f.maxAttachments}
							maxBytes={f.maxBytes}
							onCancel={() => setComposing(false)}
							onSubmit={async (input) => {
								await client?.addForumDiscussion(forumId, input);
								setComposing(false);
								refresh();
							}}
						/>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}

export default function ForumPage({ params }: { params: Promise<{ forumId: string }> }) {
	const { forumId } = use(params);
	return (
		<FeatureGate feature="Forums" functions={["mod_forum_get_forum_discussions"]}>
			<Suspense fallback={<ListSkeleton rows={4} />}>
				<ForumContent forumId={Number(forumId)} />
			</Suspense>
		</FeatureGate>
	);
}
