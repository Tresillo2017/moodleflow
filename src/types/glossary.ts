import type { ItemRating } from "./collab";

// Glossary activities (Phase 5).

export type GlossaryBrowseMode = "letter" | "category" | "author" | "date";

export interface Glossary {
	id: number;
	cmid: number;
	courseId: number;
	name: string;
	intro?: string;
	/** Ways the teacher left enabled for browsing. */
	browseModes: GlossaryBrowseMode[];
	canAddEntry: boolean;
	/** Rating aggregate type (0 = ratings off). */
	assessed: number;
	allowComments: boolean;
}

export interface GlossaryCategory {
	id: number;
	name: string;
}

export interface GlossaryEntry {
	id: number;
	glossaryId: number;
	concept: string;
	/** Rendered HTML. */
	definition: string;
	author: string;
	userId: number;
	created?: string;
	modified?: string;
	approved: boolean;
	canEdit: boolean;
	canDelete: boolean;
}

/** What to list: a letter ("ALL", "SPECIAL" or "A"), a text search, a category, authors, or newest first. */
export type GlossaryQuery =
	| { mode: "letter"; letter: string }
	| { mode: "search"; text: string }
	| { mode: "category"; categoryId: number }
	| { mode: "author" }
	| { mode: "date" };

export interface GlossaryPage {
	entries: GlossaryEntry[];
	total: number;
	/** Rating widgets by entry id. */
	ratings: Record<number, ItemRating>;
}

/** Moodle's category ids for "every category" and "not categorised". */
export const GLOSSARY_ALL_CATEGORIES = 0;
export const GLOSSARY_NOT_CATEGORISED = -1;
