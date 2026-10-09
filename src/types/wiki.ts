import type { MoodleFile } from "./moodle";

// Wiki activities (Phase 5).

export interface Wiki {
	id: number;
	cmid: number;
	courseId: number;
	name: string;
	intro?: string;
	/** Title of the page every subwiki starts from. */
	firstPageTitle: string;
	/** "individual" wikis give each student their own subwiki; "collaborative" ones share one per group. */
	mode: "collaborative" | "individual";
}

/** One wiki space: the whole class, a group, or a single user. */
export interface Subwiki {
	id: number;
	wikiId: number;
	groupId: number;
	userId: number;
	canEdit: boolean;
}

export interface WikiPageSummary {
	id: number;
	subwikiId: number;
	title: string;
	modified?: string;
}

export interface WikiPage extends WikiPageSummary {
	/** Rendered HTML (Moodle's cached content). */
	html: string;
	canEdit: boolean;
	version: number;
}

export type WikiFiles = MoodleFile[];
