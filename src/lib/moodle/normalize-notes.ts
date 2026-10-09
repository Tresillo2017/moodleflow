import type { Note, NoteState } from "@/types/notes";
import { asArray, asRecord } from "./normalize";

const time = (seconds: unknown) => (Number(seconds) > 0 ? new Date(Number(seconds) * 1000).toISOString() : undefined);
const FORMAT_HTML = 1;

// core_notes_get_course_notes: three lists, one per visibility
export function normalizeNotes(raw: unknown): Note[] {
	const r = asRecord(raw);
	const lists: [string, NoteState][] = [["personalnotes", "personal"], ["coursenotes", "course"], ["sitenotes", "site"]];
	return lists
		.flatMap(([field, state]) =>
			asArray(r[field]).map((n): Note => {
				const note = asRecord(n);
				return {
					id: Number(note.id),
					courseId: Number(note.courseid ?? 0),
					userId: Number(note.userid ?? 0),
					text: String(note.content ?? ""),
					isHtml: Number(note.format) === FORMAT_HTML,
					state,
					created: time(note.created),
					modified: time(note.lastmodified),
				};
			}),
		)
		.sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));
}

// core_notes_create_notes: one result per note, with an error message when it failed
export function createdNoteId(raw: unknown): number {
	const first = asRecord(asArray(raw)[0]);
	const error = first.errormessage;
	if (typeof error === "string" && error) throw new Error(error);
	return Number(first.noteid);
}
