// Comments and ratings that Moodle attaches to many kinds of items (Phase 5).

export interface ItemRating {
	scaleId: number;
	/** Selectable values, e.g. 1..5 or a custom scale. */
	options: { value: number; label: string }[];
	canRate: boolean;
	/** Current user's rating. */
	mine?: number;
	aggregate?: string;
	count: number;
}

/** Where a comment thread lives: Moodle's context, component, area and item id. */
export interface CommentTarget {
	contextLevel: "module" | "system" | "course" | "user";
	/** Course-module id for "module"; 0 for "system". */
	instanceId: number;
	component: string;
	area: string;
	itemId: number;
}

/** What core_rating_add_rating needs to know about the item being rated. */
export interface RatedItem {
	cmid: number;
	component: string;
	area: string;
	itemId: number;
	authorId: number;
	scaleId: number;
	/** The activity's `assessed` aggregate type. */
	aggregation: number;
}
