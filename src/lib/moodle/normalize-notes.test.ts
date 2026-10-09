import { describe, expect, it } from "vitest";
import { createdNoteId, normalizeNotes } from "./normalize-notes";

describe("notes", () => {
	it("merges the three lists, newest first", () => {
		const notes = normalizeNotes({
			personalnotes: [{ id: 1, courseid: 2, userid: 5, content: "mine", format: 2, created: 100 }],
			coursenotes: [{ id: 2, courseid: 2, userid: 5, content: "<p>teacher</p>", format: 1, created: 300 }],
			sitenotes: [],
		});
		expect(notes.map((n) => [n.id, n.state, n.isHtml])).toEqual([[2, "course", true], [1, "personal", false]]);
	});

	it("returns the created id and throws Moodle's error message", () => {
		expect(createdNoteId([{ clientnoteid: 0, noteid: 9 }])).toBe(9);
		expect(() => createdNoteId([{ clientnoteid: 0, errormessage: "No permission" }])).toThrow("No permission");
	});
});
