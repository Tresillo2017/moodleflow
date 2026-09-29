import type { ForumPost, ForumRating, ForumThread, MoodleFile, MoodleForum, MoodleForumDiscussion } from "@/types/moodle";
import { asArray, asRecord } from "./normalize";

const iso = (seconds: unknown) => new Date(Number(seconds ?? 0) * 1000).toISOString();
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

// mod_forum_get_forums_by_courses
export function normalizeForums(raw: unknown): MoodleForum[] {
	return asArray(raw).map((f) => {
		const r = asRecord(f);
		return {
			id: Number(r.id),
			cmid: Number(r.cmid ?? 0),
			courseId: Number(r.course ?? 0),
			name: String(r.name ?? ""),
			type: String(r.type ?? "general"),
			intro: str(r.intro),
			canCreateDiscussions: r.cancreatediscussions === undefined ? true : Boolean(r.cancreatediscussions),
			assessed: Number(r.assessed ?? 0),
			maxAttachments: Number(r.maxattachments ?? 0),
			maxBytes: Number(r.maxbytes) > 0 ? Number(r.maxbytes) : undefined,
			unread: r.unreadpostscount === undefined ? undefined : Number(r.unreadpostscount),
		};
	});
}

// mod_forum_get_forum_discussions
export function normalizeForumDiscussions(raw: unknown): MoodleForumDiscussion[] {
	return asArray(asRecord(raw).discussions).map((d) => {
		const disc = asRecord(d);
		const caps = (disc.capabilities && typeof disc.capabilities === "object" ? disc.capabilities : {}) as Record<string, unknown>;
		const state = (disc.userstate && typeof disc.userstate === "object" ? disc.userstate : {}) as Record<string, unknown>;
		const canLock = Boolean(disc.canlock ?? caps.canlock);
		return {
			id: Number(disc.discussion ?? disc.id),
			subject: String(disc.subject ?? disc.name ?? ""),
			author: String(disc.userfullname ?? ""),
			authorImageUrl: str(disc.userpictureurl),
			timeModified: iso(disc.timemodified),
			replies: Number(disc.numreplies ?? 0),
			unread: Number(disc.numunread ?? 0),
			pinned: Boolean(disc.pinned),
			locked: Boolean(disc.locked),
			starred: Boolean(disc.starred ?? state.favourited),
			subscribed: Boolean(disc.subscribed ?? state.subscribed),
			canReply: disc.canreply === undefined ? true : Boolean(disc.canreply),
			canPin: Boolean(disc.canpin ?? caps.pin ?? canLock),
			canLock,
			canFavourite: disc.canfavourite === undefined ? true : Boolean(disc.canfavourite),
		};
	});
}

function normalizeAttachments(raw: unknown): MoodleFile[] {
	return asArray(raw)
		.map(asRecord)
		.filter((a) => typeof a.fileurl === "string")
		.map((a) => ({
			name: String(a.filename ?? ""),
			url: String(a.fileurl),
			size: Number(a.filesize ?? 0),
			mimeType: str(a.mimetype),
		}));
}

/** Rating widgets by post id, from the thread-level `ratinginfo` block. */
function ratingsByItem(raw: unknown): Map<number, ForumRating> {
	const info = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
	const scales = asArray(info.scales).map(asRecord);
	const out = new Map<number, ForumRating>();
	for (const entry of asArray(info.ratings).map(asRecord)) {
		const scaleId = Number(entry.scaleid);
		const scale = scales.find((s) => Number(s.id) === scaleId);
		const items = asArray(scale?.scaleitems).map(asRecord);
		const max = Number(scale?.max ?? 0);
		const options = items.length
			? items.map((i) => ({ value: Number(i.value), label: String(i.name ?? i.value) }))
			: Array.from({ length: max }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
		if (!options.length) continue;
		const mine = entry.rating === undefined || entry.rating === null || entry.rating === "" ? undefined : Number(entry.rating);
		out.set(Number(entry.itemid), {
			scaleId,
			options,
			canRate: Boolean(entry.canrate),
			mine: mine && mine > 0 ? mine : undefined,
			aggregate: entry.canviewaggregate === false ? undefined : str(entry.aggregatestr),
			count: Number(entry.count ?? 0),
		});
	}
	return out;
}

// mod_forum_get_discussion_posts
export function normalizeForumThread(raw: unknown, discussionId: number): ForumThread {
	const r = asRecord(raw);
	const ratings = ratingsByItem(r.ratinginfo);
	const posts = asArray(r.posts).map((p): ForumPost => {
		const post = asRecord(p);
		const author = (post.author && typeof post.author === "object" ? post.author : {}) as Record<string, unknown>;
		const urls = (author.urls && typeof author.urls === "object" ? author.urls : {}) as Record<string, unknown>;
		const caps = (post.capabilities && typeof post.capabilities === "object" ? post.capabilities : {}) as Record<string, unknown>;
		const id = Number(post.id);
		return {
			id,
			discussionId: Number(post.discussionid ?? discussionId),
			parentId: Number(post.parentid ?? post.parent ?? 0) || 0,
			subject: String(post.subject ?? ""),
			message: String(post.message ?? ""),
			authorId: Number(author.id ?? post.userid ?? 0),
			author: String(author.fullname ?? post.userfullname ?? ""),
			authorImageUrl: str(urls.profileimage) ?? str(urls.profileimageurl) ?? str(post.userpictureurl),
			timeCreated: iso(post.timecreated ?? post.created),
			unread: Boolean(post.unread),
			deleted: Boolean(post.isdeleted),
			privateReply: Boolean(post.isprivatereply),
			attachments: normalizeAttachments(post.attachments),
			canReply: Boolean(caps.reply ?? post.canreply),
			canEdit: Boolean(caps.edit),
			canDelete: Boolean(caps.delete),
			rating: ratings.get(id),
		};
	});
	return { discussionId, forumId: Number(r.forumid ?? 0), courseId: Number(r.courseid ?? 0), posts };
}

export interface PostNode {
	post: ForumPost;
	depth: number;
}

/** Flattens posts into reading order (each reply directly under its parent, oldest first); orphans become roots. */
export function threadOrder(posts: ForumPost[]): PostNode[] {
	const ids = new Set(posts.map((p) => p.id));
	const children = new Map<number, ForumPost[]>();
	for (const p of posts) {
		const parent = ids.has(p.parentId) ? p.parentId : 0;
		children.set(parent, [...(children.get(parent) ?? []), p]);
	}
	const out: PostNode[] = [];
	const walk = (parent: number, depth: number) => {
		const list = [...(children.get(parent) ?? [])].sort((a, b) => a.timeCreated.localeCompare(b.timeCreated) || a.id - b.id);
		for (const post of list) {
			out.push({ post, depth });
			walk(post.id, depth + 1);
		}
	};
	walk(0, 0);
	return out;
}
