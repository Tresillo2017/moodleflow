import type { MoodleFile } from "./moodle";

// Database activities (Phase 5).

export type DatabaseFieldType =
	| "text"
	| "textarea"
	| "number"
	| "url"
	| "latlong"
	| "menu"
	| "multimenu"
	| "radiobutton"
	| "checkbox"
	| "date"
	| "picture"
	| "file"
	| "unsupported";

export interface Database {
	id: number;
	cmid: number;
	courseId: number;
	name: string;
	intro?: string;
	/** Entries by students need a teacher's approval before others see them. */
	requiresApproval: boolean;
	timeOpen?: string;
	timeClose?: string;
}

export interface DatabaseField {
	id: number;
	type: DatabaseFieldType;
	name: string;
	description?: string;
	required: boolean;
	/** Menu, multi-menu, radio and checkbox choices. */
	options: string[];
}

export interface DatabaseContent {
	/** Text, number, menu choice, url, latitude, timestamp, or "a##b" for multiple choices. */
	content: string;
	/** Second part: url text, longitude, picture alt, or textarea format. */
	content1?: string;
	files: MoodleFile[];
}

export interface DatabaseEntry {
	id: number;
	userId: number;
	author: string;
	created?: string;
	modified?: string;
	approved: boolean;
	canManage: boolean;
	/** By field id. */
	contents: Record<number, DatabaseContent>;
}

export interface DatabaseAccess {
	canAdd: boolean;
	canApprove: boolean;
}

export interface DatabasePage {
	entries: DatabaseEntry[];
	total: number;
}

/** One value of mod_data_add_entry / update_entry's `data` list; `value` is already JSON-encoded. */
export interface DatabaseSubmission {
	fieldid: number;
	subfield?: string;
	value: string;
}
