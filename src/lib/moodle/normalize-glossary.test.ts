import { describe, expect, it } from "vitest";
import { normalizeGlossaries, normalizeGlossaryCategories, normalizeGlossaryPage } from "./normalize-glossary";

describe("glossary", () => {
	it("maps browse modes and falls back to the alphabet", () => {
		const [a, b] = normalizeGlossaries({ glossaries: [{ id: 1, coursemodule: 4, course: 2, name: "Terms", browsemodes: ["letter", "cat", "bogus"], canaddentry: 1 }, { id: 2, name: "Bare" }] });
		expect(a).toMatchObject({ id: 1, cmid: 4, browseModes: ["letter", "category"], canAddEntry: true });
		expect(b.browseModes).toEqual(["letter"]);
	});

	it("maps categories", () => {
		expect(normalizeGlossaryCategories({ categories: [{ id: 3, name: "Maths" }] })).toEqual([{ id: 3, name: "Maths" }]);
	});

	it("maps a page of entries with the total", () => {
		const page = normalizeGlossaryPage({ count: 41, entries: [{ id: 9, glossaryid: 1, concept: "Limit", definition: "<p>x</p>", userfullname: "Ana", userid: 7, timecreated: 100, canupdate: 1, candelete: 0 }] });
		expect(page.total).toBe(41);
		expect(page.entries[0]).toMatchObject({ id: 9, concept: "Limit", author: "Ana", approved: true, canEdit: true, canDelete: false });
	});

	it("falls back to the entry count when the total is missing", () => {
		expect(normalizeGlossaryPage({ entries: [{ id: 1 }, { id: 2 }] }).total).toBe(2);
	});
});
