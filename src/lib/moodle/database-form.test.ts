import { describe, expect, it } from "vitest";
import { buildSubmission, initialValues, missingFields } from "./database-form";
import { normalizeDatabaseAccess, normalizeDatabaseFields, normalizeDatabasePage, normalizeDatabases } from "./normalize-database";

const fields = normalizeDatabaseFields({
	fields: [
		{ id: 1, type: "text", name: "Title", required: 1 },
		{ id: 2, type: "multimenu", name: "Tags", param1: "a\nb\n" },
		{ id: 3, type: "date", name: "When" },
		{ id: 4, type: "url", name: "Link" },
		{ id: 5, type: "picture", name: "Photo" },
		{ id: 6, type: "mystery", name: "?" },
	],
});

describe("database normalizers", () => {
	it("maps fields and options, unknown types are unsupported", () => {
		expect(fields[1]).toMatchObject({ type: "multimenu", options: ["a", "b"] });
		expect(fields[0].required).toBe(true);
		expect(fields[5].type).toBe("unsupported");
	});

	it("maps databases", () => {
		const [d] = normalizeDatabases({ databases: [{ id: 1, coursemodule: 2, course: 3, name: "Sightings", approval: 1 }] });
		expect(d).toMatchObject({ id: 1, cmid: 2, requiresApproval: true });
	});

	it("maps entries by field id with files and the total", () => {
		const page = normalizeDatabasePage({ totalcount: 9, entries: [{ id: 5, userid: 2, fullname: "Ana", approved: 0, canmanageentry: 1, contents: [{ fieldid: 5, content: "p.png", content1: "alt", files: [{ filename: "p.png", fileurl: "https://x/p.png", filesize: 4 }] }] }] });
		expect(page.total).toBe(9);
		expect(page.entries[0]).toMatchObject({ approved: false, canManage: true });
		expect(page.entries[0].contents[5].files[0].name).toBe("p.png");
	});

	it("maps access", () => {
		expect(normalizeDatabaseAccess({ canaddentry: 1, canapprove: 0 })).toMatchObject({ canAdd: true, canApprove: false });
	});
});

describe("database form", () => {
	it("prefills from an entry", () => {
		const entry = normalizeDatabasePage({ entries: [{ id: 1, contents: [{ fieldid: 1, content: "Hi" }, { fieldid: 2, content: "a##b" }, { fieldid: 3, content: "86400" }, { fieldid: 4, content: "https://x", content1: "X" }] }] }).entries[0];
		const v = initialValues(fields, entry);
		expect(v).toMatchObject({ f1: "Hi", f2: ["a", "b"], f3: "1970-01-02", f4: "https://x", f4_1: "X" });
	});

	it("reports missing required fields", () => {
		expect(missingFields(fields, initialValues(fields))).toEqual(["Title"]);
		expect(missingFields(fields, { ...initialValues(fields), f1: "ok" })).toEqual([]);
	});

	it("builds the submission, skipping unsupported fields and files without an upload", () => {
		const values = { ...initialValues(fields), f1: "Hi", f2: ["a"], f3: "2026-10-09", f4: "https://x", f4_1: "X" };
		const data = buildSubmission(fields, values);
		expect(data).toContainEqual({ fieldid: 1, subfield: undefined, value: '"Hi"' });
		expect(data).toContainEqual({ fieldid: 2, subfield: undefined, value: '["a"]' });
		expect(data.filter((d) => d.fieldid === 3).map((d) => [d.subfield, d.value])).toEqual([["day", "9"], ["month", "10"], ["year", "2026"]]);
		expect(data.filter((d) => d.fieldid === 4)).toHaveLength(2);
		expect(data.some((d) => d.fieldid === 5 || d.fieldid === 6)).toBe(false);
	});

	it("includes an uploaded picture's draft area and alt text", () => {
		const data = buildSubmission(fields, { ...initialValues(fields), f5_1: "a cat" }, { 5: 77 });
		expect(data.filter((d) => d.fieldid === 5)).toEqual([{ fieldid: 5, subfield: "file", value: "77" }, { fieldid: 5, subfield: "alt", value: '"a cat"' }]);
	});
});
