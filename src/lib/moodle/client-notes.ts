import { callMoodle, type MoodleParams } from "./call";
import { createdNoteId, normalizeNotes } from "./normalize-notes";
import type { SocialContext } from "./client-social";
import type { Note } from "@/types/notes";

const FORMAT_PLAIN = 2;

/** Notes about the signed-in user, for one course or the site (course id 0). Phase 5. */
export interface NotesApi {
	getNotes(courseId: number): Promise<Note[]>;
	/** Adds a note only you can read; resolves to its id. */
	addNote(courseId: number, text: string): Promise<number>;
	deleteNote(noteId: number): Promise<void>;
}

export function createNotesApi({ connection, userId }: SocialContext): NotesApi {
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");

	return {
		async getNotes(courseId) {
			return normalizeNotes(await callMoodle(connection, "core_notes_get_course_notes", { courseid: courseId, userid: await userId() }));
		},
		async addNote(courseId, text) {
			const note = { userid: await userId(), publishstate: "personal", courseid: courseId, text, format: FORMAT_PLAIN };
			return createdNoteId(await post("core_notes_create_notes", { notes: { 0: note } }));
		},
		async deleteNote(noteId) {
			await post("core_notes_delete_notes", { notes: { 0: noteId } });
		},
	};
}
