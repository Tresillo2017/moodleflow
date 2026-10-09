import { callMoodle, type MoodleParams } from "./call";
import { normalizeSubwikis, normalizeWikiFiles, normalizeWikiPage, normalizeWikiPages, normalizeWikis } from "./normalize-wiki";
import type { SocialContext } from "./client-social";
import type { MoodleFile } from "@/types/moodle";
import type { Subwiki, Wiki, WikiPage, WikiPageSummary } from "@/types/wiki";

/** Wiki activities (Phase 5). */
export interface WikiApi {
	getWikis(courseId: number): Promise<Wiki[]>;
	getSubwikis(wikiId: number): Promise<Subwiki[]>;
	getWikiPages(wiki: Wiki, subwiki: Subwiki): Promise<WikiPageSummary[]>;
	getWikiPage(pageId: number): Promise<WikiPage>;
	getWikiFiles(subwiki: Subwiki): Promise<MoodleFile[]>;
	/** Tells Moodle the page was read. Best effort. */
	logWikiPageView(pageId: number): Promise<void>;
}

export function createWikiApi({ connection }: SocialContext): WikiApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
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
		async logWikiPageView(pageId) {
			await callMoodle(connection, "mod_wiki_view_page", { pageid: pageId }, "POST").catch(() => undefined);
		},
	};
}
