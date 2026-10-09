import type { NotesApi } from "./client-notes";
import type { Note } from "@/types/notes";

const wait = <T>(value: T, ms = 150): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));

const notes: Note[] = [
	{ id: 1, courseId: 1, userId: 1, text: "Ask about the ratio test in the next lecture.", isHtml: false, state: "personal", created: new Date(Date.now() - 2 * 86_400_000).toISOString() },
];
let nextId = 2;

export function createMockNotesApi(): NotesApi {
	return {
		getNotes: (courseId) => wait(notes.filter((n) => n.courseId === courseId)),
		addNote: (courseId, text) => {
			const id = nextId++;
			notes.unshift({ id, courseId, userId: 1, text, isHtml: false, state: "personal", created: new Date().toISOString() });
			return wait(id);
		},
		deleteNote: (noteId) => {
			const i = notes.findIndex((n) => n.id === noteId);
			if (i >= 0) notes.splice(i, 1);
			return wait(undefined);
		},
	};
}
