import { callMoodle, type MoodleParams } from "./call";
import { normalizeSubwikis, normalizeWikiEditing, normalizeWikiFiles, normalizeWikiPage, normalizeWikiPages, normalizeWikis } from "./normalize-wiki";
import { asRecord } from "./normalize";
import type { SocialContext } from "./client-social";
import type { MoodleFile } from "@/types/moodle";
import type { Subwiki, Wiki, WikiEditing, WikiPage, WikiPageSummary } from "@/types/wiki";

/** Wiki activities (Phase 5). */
export interface WikiApi {
	getWikis(courseId: number): Promise<Wiki[]>;
	getSubwikis(wikiId: number): Promise<Subwiki[]>;
	getWikiPages(wiki: Wiki, subwiki: Subwiki): Promise<WikiPageSummary[]>;
	getWikiPage(pageId: number): Promise<WikiPage>;
	getWikiFiles(subwiki: Subwiki): Promise<MoodleFile[]>;
	/** Opens the page for editing; Moodle locks it for this user and throws if someone else holds the lock. */
	getWikiPageForEditing(pageId: number): Promise<WikiEditing>;
	/** Saves the page and releases the lock. */
	saveWikiPage(pageId: number, html: string): Promise<void>;
	/** Creates a page in the subwiki and resolves to its id. */
	createWikiPage(subwiki: Subwiki, title: string, html: string): Promise<number>;
	/** Tells Moodle the page was read. Best effort. */
	logWikiPageView(pageId: number): Promise<void>;
}

export function createWikiApi({ connection }: SocialContext): WikiApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");
	const scope = (s: Subwiki) => ({ wikiid: s.wikiId, groupid: s.groupId, userid: s.userId });

	return {
		async getWikis(courseId) {
			return normalizeWikis(await get("mod_wiki_get_wikis_by_courses", { courseids: { 0: courseId } }));
		},
		async getSubwikis(wikiId) {
			return normalizeSubwikis(await get("mod_wiki_get_subwikis", { wikiid: wikiId }));
		},
		async getWikiPages(wiki, subwiki) {
			return normalizeWikiPages(await get("mod_wiki_get_subwiki_pages", scope(subwiki)), wiki.firstPageTitle);
		},
		async getWikiPage(pageId) {
			return normalizeWikiPage(await get("mod_wiki_get_page_contents", { pageid: pageId }));
		},
		async getWikiFiles(subwiki) {
			return normalizeWikiFiles(await get("mod_wiki_get_subwiki_files", scope(subwiki)));
		},
		async getWikiPageForEditing(pageId) {
			return normalizeWikiEditing(await post("mod_wiki_get_page_for_editing", { pageid: pageId }));
		},
		async saveWikiPage(pageId, html) {
			await post("mod_wiki_edit_page", { pageid: pageId, content: html });
		},
		async createWikiPage(subwiki, title, html) {
			const created = asRecord(await post("mod_wiki_new_page", { title, content: html, contentformat: "html", subwikiid: subwiki.id }));
			return Number(created.pageid);
		},
		async logWikiPageView(pageId) {
			await callMoodle(connection, "mod_wiki_view_page", { pageid: pageId }, "POST").catch(() => undefined);
		},
	};
}
