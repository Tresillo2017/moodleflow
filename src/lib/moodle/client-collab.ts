import { callMoodle, type MoodleParams } from "./call";
import { normalizeCommentPage } from "./normalize-comments";
import type { SocialContext } from "./client-social";
import type { CommentTarget, RatedItem } from "@/types/collab";
import type { MoodleComment } from "@/types/moodle";

export interface CommentThread {
	comments: MoodleComment[];
	canPost: boolean;
}

/** Comments and ratings on anything Moodle lets users comment on or rate (Phase 5). */
export interface CollabApi {
	/** Every comment on the item, oldest first. */
	getComments(target: CommentTarget): Promise<CommentThread>;
	addComment(target: CommentTarget, content: string): Promise<void>;
	deleteComment(commentId: number): Promise<void>;
	rateItem(item: RatedItem, rating: number): Promise<void>;
}

/** Safety stop for items with a huge number of comments. */
const MAX_COMMENT_PAGES = 10;

const where = (t: CommentTarget): MoodleParams => ({ contextlevel: t.contextLevel, instanceid: t.instanceId, component: t.component, itemid: t.itemId, area: t.area });

export function createCollabApi({ connection }: SocialContext): CollabApi {
	return {
		async getComments(target) {
			const comments: CommentThread["comments"] = [];
			let canPost = true;
			for (let page = 0; page < MAX_COMMENT_PAGES; page++) {
				const result = normalizeCommentPage(await callMoodle(connection, "core_comment_get_comments", { ...where(target), page, sortdirection: "ASC" }));
				comments.push(...result.comments);
				canPost = result.canPost;
				if (result.comments.length === 0 || comments.length >= result.count) break;
			}
			return { comments, canPost };
		},
		async addComment(target, content) {
			await callMoodle(connection, "core_comment_add_comments", { comments: { 0: { ...where(target), content } } }, "POST");
		},
		async deleteComment(commentId) {
			await callMoodle(connection, "core_comment_delete_comments", { comments: { 0: commentId } }, "POST");
		},
		async rateItem(item, rating) {
			await callMoodle(
				connection,
				"core_rating_add_rating",
				{
					contextlevel: "module",
					instanceid: item.cmid,
					component: item.component,
					ratingarea: item.area,
					itemid: item.itemId,
					scaleid: item.scaleId,
					rating,
					rateduserid: item.authorId,
					aggregation: item.aggregation,
				},
				"POST",
			);
		},
	};
}
