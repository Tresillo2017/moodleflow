import { describe, expect, it } from "vitest";
import { normalizeSubwikis, normalizeWikiFiles, normalizeWikiPage, normalizeWikiPages, normalizeWikis, wikiLinkPageId } from "./normalize-wiki";

describe("wiki", () => {
	it("maps wiki settings", () => {
		const [w] = normalizeWikis({ wikis: [{ id: 2, coursemodule: 8, course: 1, name: "Notes", wikimode: "individual", firstpagetitle: "Home" }] });
		expect(w).toMatchObject({ id: 2, cmid: 8, mode: "individual", firstPageTitle: "Home" });
	});

	it("maps subwikis", () => {
		expect(normalizeSubwikis({ subwikis: [{ id: 1, wikiid: 2, groupid: 0, userid: 5, canedit: 1 }] })[0]).toMatchObject({ userId: 5, canEdit: true });
	});

	it("puts the first page on top, then sorts by title", () => {
		const pages = normalizeWikiPages({ pages: [{ id: 1, subwikiid: 1, title: "Zeta" }, { id: 2, subwikiid: 1, title: "Alpha" }, { id: 3, subwikiid: 1, title: "Home" }] }, "Home");
		expect(pages.map((p) => p.title)).toEqual(["Home", "Alpha", "Zeta"]);
	});

	it("maps page contents", () => {
		const p = normalizeWikiPage({ page: { id: 3, subwikiid: 1, title: "Home", cachedcontent: "<p>Hi</p>", caneditpage: true, version: 4, timemodified: 100 } });
		expect(p).toMatchObject({ id: 3, html: "<p>Hi</p>", canEdit: true, version: 4 });
	});

	it("keeps only files with a url", () => {
		expect(normalizeWikiFiles({ files: [{ filename: "a.pdf", fileurl: "https://x/a.pdf", filesize: 3 }, { filename: "b" }] })).toHaveLength(1);
	});

	it("recognises wiki page links", () => {
		expect(wikiLinkPageId("https://m.example/mod/wiki/view.php?pageid=12")).toBe(12);
		expect(wikiLinkPageId("/mod/wiki/view.php?pageid=7&title=x")).toBe(7);
		expect(wikiLinkPageId("https://m.example/mod/forum/view.php?id=3")).toBeNull();
		expect(wikiLinkPageId(null)).toBeNull();
	});
});
