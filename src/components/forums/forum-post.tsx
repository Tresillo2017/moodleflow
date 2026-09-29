"use client";

import { useState } from "react";
import { CornerDownRight, Pencil, Reply, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichContent } from "@/components/content/rich-content";
import { FileList } from "@/components/files/file-list";
import { PersonAvatar } from "@/components/people/person-avatar";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { PostEditor } from "@/components/forums/post-editor";
import { formatDistanceToNow } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { RatingTarget } from "@/lib/moodle/client-social";
import type { ForumPost, MoodleForum } from "@/types/moodle";

/** Replies nest visually up to this depth; deeper ones keep the last indent so long threads stay readable. */
const MAX_INDENT = 4;

function RatingControl({ post, forum, onRated }: { post: ForumPost; forum: MoodleForum; onRated: () => void }) {
	const { client } = useMoodleConnection();
	const rating = post.rating;
	if (!rating || (!rating.canRate && !rating.aggregate)) return null;

	async function rate(value: number) {
		if (!client || !rating) return;
		const target: RatingTarget = { cmid: forum.cmid, postId: post.id, authorId: post.authorId, scaleId: rating.scaleId, aggregation: forum.assessed };
		try {
			await client.ratePost(target, value);
			onRated();
		} catch {
			toast.error("Couldn't save your rating.");
		}
	}

	return (
		<span className="flex items-center gap-2 text-xs text-muted-foreground">
			<Star className="size-3.5" aria-hidden="true" />
			{rating.aggregate && <span>{rating.aggregate}</span>}
			{rating.canRate && (
				<select aria-label="Rate this post" value={rating.mine ?? ""} onChange={(e) => e.target.value && void rate(Number(e.target.value))} className="h-6 rounded-md border bg-background px-1">
					<option value="">Rate…</option>
					{rating.options.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			)}
		</span>
	);
}

interface ForumPostViewProps {
	post: ForumPost;
	depth: number;
	forum: MoodleForum | undefined;
	discussionLocked: boolean;
	onChanged: () => void;
}

export function ForumPostView({ post, depth, forum, discussionLocked, onChanged }: ForumPostViewProps) {
	const { client } = useMoodleConnection();
	const [mode, setMode] = useState<"view" | "reply" | "edit" | "confirm-delete">("view");

	async function remove() {
		try {
			await client?.deletePost(post.id);
			onChanged();
		} catch {
			toast.error("Couldn't delete the post.");
			setMode("view");
		}
	}

	const canReply = post.canReply && !discussionLocked && !post.deleted;
	return (
		<article
			id={`p${post.id}`}
			style={{ marginLeft: `${Math.min(depth, MAX_INDENT) * 1.25}rem` }}
			className={cn("flex gap-3 rounded-xl border bg-card p-4", post.unread && "border-primary/40 bg-accent/30")}
		>
			<PersonAvatar name={post.author} imageUrl={post.authorImageUrl} />
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<header className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
					{depth > 0 && <CornerDownRight className="size-3 self-center" aria-hidden="true" />}
					<span className="text-sm font-medium text-foreground">{post.author}</span>
					<time dateTime={post.timeCreated}>{formatDistanceToNow(post.timeCreated)}</time>
					{post.unread && <span className="text-primary">New</span>}
					{post.privateReply && <span>Private reply</span>}
				</header>
				{post.deleted ? (
					<p className="text-sm text-muted-foreground italic">This post was deleted.</p>
				) : mode === "edit" ? (
					<PostEditor
						initialSubject={post.subject}
						initialMessage={post.message}
						submitLabel="Save changes"
						onCancel={() => setMode("view")}
						onSubmit={async (input) => {
							await client?.updatePost(post.id, input);
							setMode("view");
							onChanged();
						}}
					/>
				) : (
					<>
						{depth === 0 || !/^re:/i.test(post.subject) ? <h3 className="text-base font-medium">{post.subject}</h3> : null}
						<RichContent html={post.message} />
						{post.attachments.length > 0 && <FileList files={post.attachments} />}
					</>
				)}
				{mode !== "edit" && !post.deleted && (
					<footer className="flex flex-wrap items-center gap-1">
						{canReply && (
							<Button variant="ghost" size="xs" onClick={() => setMode(mode === "reply" ? "view" : "reply")}>
								<Reply aria-hidden="true" />
								Reply
							</Button>
						)}
						{post.canEdit && !discussionLocked && (
							<Button variant="ghost" size="xs" onClick={() => setMode("edit")}>
								<Pencil aria-hidden="true" />
								Edit
							</Button>
						)}
						{post.canDelete && mode !== "confirm-delete" && (
							<Button variant="ghost" size="xs" onClick={() => setMode("confirm-delete")}>
								<Trash2 aria-hidden="true" />
								Delete
							</Button>
						)}
						{mode === "confirm-delete" && (
							<>
								<Button variant="destructive" size="xs" onClick={remove}>
									Delete post{post.parentId === 0 ? " and replies" : ""}
								</Button>
								<Button variant="ghost" size="xs" onClick={() => setMode("view")}>
									Keep
								</Button>
							</>
						)}
						{forum && <span className="ml-auto"><RatingControl post={post} forum={forum} onRated={onChanged} /></span>}
					</footer>
				)}
				{mode === "reply" && (
					<div className="mt-1 border-t pt-3">
						<PostEditor
							initialSubject={/^re:/i.test(post.subject) ? post.subject : `Re: ${post.subject}`}
							showSubject={false}
							submitLabel="Post reply"
							maxAttachments={forum?.maxAttachments ?? 0}
							maxBytes={forum?.maxBytes}
							onCancel={() => setMode("view")}
							onSubmit={async (input) => {
								await client?.replyToPost(post.id, { ...input, subject: /^re:/i.test(post.subject) ? post.subject : `Re: ${post.subject}` });
								setMode("view");
								onChanged();
							}}
						/>
					</div>
				)}
			</div>
		</article>
	);
}
