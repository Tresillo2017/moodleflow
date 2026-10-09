import type { MoodleComment } from "@/types/moodle";
import { asArray, asRecord } from "./normalize";

export interface CommentPage {
	comments: MoodleComment[];
	/** Comments on the item in total, across pages. */
	count: number;
	perPage: number;
	canPost: boolean;
}

// core_comment_get_comments
export function normalizeCommentPage(raw: unknown): CommentPage {
	const r = asRecord(raw);
	const comments = asArray(r.comments).map((c): MoodleComment => {
		const comment = asRecord(c);
		return {
			id: Number(comment.id),
			author: String(comment.fullname ?? ""),
			content: String(comment.content ?? ""),
			time: new Date(Number(comment.timecreated ?? 0) * 1000).toISOString(),
			canDelete: Boolean(comment.delete),
		};
	});
	return { comments, count: Number(r.count ?? comments.length), perPage: Number(r.perpage ?? 0), canPost: r.canpost === undefined ? true : Boolean(r.canpost) };
}
