// Notes (Phase 5).

export type NoteState = "personal" | "course" | "site";

export interface Note {
	id: number;
	courseId: number;
	/** The user the note is about. */
	userId: number;
	text: string;
	/** `text` is HTML (written elsewhere in Moodle) rather than plain text. */
	isHtml: boolean;
	state: NoteState;
	created?: string;
	modified?: string;
}
