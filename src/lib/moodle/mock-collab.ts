import type { CollabApi } from "./client-collab";
import type { CommentTarget, ItemRating, RatedItem } from "@/types/collab";
import type { MoodleComment } from "@/types/moodle";

const wait = <T>(value: T, ms = 150): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));

const threadKey = (t: CommentTarget) => `${t.component}/${t.area}/${t.itemId}`;
const comments = new Map<string, MoodleComment[]>();
const ratings = new Map<string, number>();
let nextId = 100;

const ratingKey = (component: string, area: string, itemId: number) => `${component}/${area}/${itemId}`;

/** A 1–5 rating widget for a mock item, reflecting whatever the user rated it so far. */
export function mockRating(component: string, area: string, itemId: number): ItemRating {
	const mine = ratings.get(ratingKey(component, area, itemId));
	return {
		scaleId: -5,
		options: [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) })),
		canRate: true,
		mine,
		aggregate: mine ? String(mine) : undefined,
		count: mine ? 1 : 0,
	};
}

export function createMockCollabApi(): CollabApi {
	return {
		getComments: (target) => wait({ comments: [...(comments.get(threadKey(target)) ?? [])], canPost: true }),
		addComment: (target, content) => {
			const list = comments.get(threadKey(target)) ?? [];
			comments.set(threadKey(target), [...list, { id: nextId++, author: "Tomas", content: `<p>${content.replace(/</g, "&lt;")}</p>`, time: new Date().toISOString(), canDelete: true }]);
			return wait(undefined);
		},
		deleteComment: (commentId) => {
			for (const [key, list] of comments) comments.set(key, list.filter((c) => c.id !== commentId));
			return wait(undefined);
		},
		rateItem: (item: RatedItem, rating) => {
			ratings.set(ratingKey(item.component, item.area, item.itemId), rating);
			return wait(undefined);
		},
	};
}
