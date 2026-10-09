import type { WikiApi } from "./client-wiki";
import type { Subwiki, Wiki, WikiPage } from "@/types/wiki";

const wait = <T>(value: T, ms = 200): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));

const wikis: Wiki[] = [
	{ id: 1, cmid: 40, courseId: 1, name: "Class wiki", intro: "<p>Build the course glossary and revision notes together.</p>", firstPageTitle: "Home", mode: "collaborative" },
];
const subwikis: Subwiki[] = [{ id: 1, wikiId: 1, groupId: 0, userId: 0, canEdit: true }];

const page = (id: number, title: string, html: string): WikiPage => ({ id, subwikiId: 1, title, html, canEdit: true, version: 1, modified: new Date(Date.now() - id * 86_400_000).toISOString() });
const pages: WikiPage[] = [
	page(1, "Home", '<p>Welcome! Start with <a href="/mod/wiki/view.php?pageid=2">Revision notes</a> or the <a href="/mod/wiki/view.php?pageid=3">Formula sheet</a>.</p>'),
	page(2, "Revision notes", "<h3>Series</h3><p>Check convergence with the ratio test first.</p><h3>Integrals</h3><ul><li>Substitution</li><li>By parts</li></ul>"),
	page(3, "Formula sheet", '<p>Back to <a href="/mod/wiki/view.php?pageid=1">Home</a>.</p><table><tr><th>Rule</th><th>Formula</th></tr><tr><td>Product</td><td>(uv)\' = u\'v + uv\'</td></tr></table>'),
];

export function createMockWikiApi(): WikiApi {
	return {
		getWikis: (courseId) => wait(wikis.filter((w) => w.courseId === courseId)),
		getSubwikis: (wikiId) => wait(subwikis.filter((s) => s.wikiId === wikiId)),
		getWikiPages: () => wait(pages.map(({ html: _html, canEdit: _c, version: _v, ...summary }) => summary)),
		getWikiPage: (pageId) => {
			const p = pages.find((x) => x.id === pageId);
			return p ? wait(p) : Promise.reject(new Error("Page not found"));
		},
		getWikiPageForEditing: (pageId) => {
			const p = pages.find((x) => x.id === pageId);
			return p ? wait({ content: p.html, format: "html", version: p.version }) : Promise.reject(new Error("Page not found"));
		},
		saveWikiPage: (pageId, html) => {
			const i = pages.findIndex((x) => x.id === pageId);
			if (i >= 0) pages[i] = { ...pages[i], html, version: pages[i].version + 1, modified: new Date().toISOString() };
			return wait(undefined);
		},
		createWikiPage: (_subwiki, title, html) => {
			const id = Math.max(...pages.map((p) => p.id)) + 1;
			pages.push(page(id, title, html));
			return wait(id);
		},
		getWikiFiles: () => wait([]),
		logWikiPageView: () => wait(undefined, 0),
	};
}
