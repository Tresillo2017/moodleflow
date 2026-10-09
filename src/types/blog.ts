import type { MoodleFile } from "./moodle";

// Blog entries (Phase 5).

/** Who can read an entry: only its author (draft) or everyone on the site. */
export type BlogPublishState = "draft" | "site" | "public";

export interface BlogEntry {
	id: number;
	userId: number;
	author: string;
	subject: string;
	/** Rendered HTML. */
	html: string;
	tags: string[];
	publishState: BlogPublishState;
	created?: string;
	modified?: string;
	attachments: MoodleFile[];
	/** The signed-in user wrote it. */
	canEdit: boolean;
}

export interface BlogAccess {
	canCreate: boolean;
}

/** Narrows the entries listed; with no field set, everything the user may see. */
export interface BlogFilter {
	userId?: number;
	courseId?: number;
	tag?: string;
}

export interface BlogInput {
	subject: string;
	html: string;
	tags: string[];
	publishState: BlogPublishState;
}

export interface BlogPage {
	entries: BlogEntry[];
	total: number;
}
