import { describe, expect, it } from "vitest";
import { blogAuthorIds, blogFilters, blogOptions, normalizeBlogPage, normalizeUserNames, parseTags } from "./normalize-blog";

const raw = {
	totalentries: 7,
	entries: [
		{ id: 1, userid: 5, subject: "Week one", summary: "<p>Hi</p>", publishstate: "draft", created: 100, lastmodified: 200, tags: [{ rawname: "notes" }], attachmentfiles: [{ filename: "a.pdf", fileurl: "https://x/a.pdf", filesize: 3 }] },
		{ id: 2, userid: 9, subject: "Other", summary: "", publishstate: "weird" },
	],
};

describe("blog", () => {
	it("maps entries, names, tags and ownership", () => {
		const page = normalizeBlogPage(raw, new Map([[5, "Tomas"]]), 5);
		expect(page.total).toBe(7);
		expect(page.entries[0]).toMatchObject({ author: "Tomas", publishState: "draft", tags: ["notes"], canEdit: true });
		expect(page.entries[0].attachments).toHaveLength(1);
		expect(page.entries[1]).toMatchObject({ author: "User 9", publishState: "site", canEdit: false });
	});

	it("lists distinct author ids and maps user names", () => {
		expect(blogAuthorIds(raw)).toEqual([5, 9]);
		expect(normalizeUserNames([{ id: 5, fullname: "Tomas" }]).get(5)).toBe("Tomas");
	});

	it("builds filters and options", () => {
		expect(blogFilters({ userId: 5, tag: "x" })).toEqual([{ name: "userid", value: "5" }, { name: "tag", value: "x" }]);
		expect(blogFilters({})).toEqual([]);
		expect(blogOptions({ subject: "s", html: "", tags: ["a", "b"], publishState: "site" })).toEqual([{ name: "publishstate", value: "site" }, { name: "tags", value: "a,b" }]);
	});

	it("parses tag text", () => {
		expect(parseTags("a, b ,,a,c")).toEqual(["a", "b", "c"]);
	});
});
