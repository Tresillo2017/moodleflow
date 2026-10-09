import { callMoodle, type MoodleParams } from "./call";
import { normalizeGlossaries, normalizeGlossaryCategories, normalizeGlossaryPage } from "./normalize-glossary";
import type { SocialContext } from "./client-social";
import type { Glossary, GlossaryCategory, GlossaryPage, GlossaryQuery } from "@/types/glossary";

/** Glossary activities (Phase 5). */
export interface GlossaryApi {
	getGlossaries(courseId: number): Promise<Glossary[]>;
	getGlossaryCategories(glossaryId: number): Promise<GlossaryCategory[]>;
	/** The first `limit` entries matching the query. */
	getGlossaryEntries(glossaryId: number, query: GlossaryQuery, limit: number): Promise<GlossaryPage>;
	/** Tells Moodle the glossary was opened. Best effort. */
	logGlossaryView(glossaryId: number): Promise<void>;
}

export function createGlossaryApi({ connection }: SocialContext): GlossaryApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);

	return {
		async getGlossaries(courseId) {
			return normalizeGlossaries(await get("mod_glossary_get_glossaries_by_courses", { courseids: { 0: courseId } }));
		},
		async getGlossaryCategories(glossaryId) {
			return normalizeGlossaryCategories(await get("mod_glossary_get_categories", { id: glossaryId, from: 0, limit: 100 }));
		},
		async getGlossaryEntries(id, query, limit) {
			const page = { id, from: 0, limit };
			switch (query.mode) {
				case "letter":
					return normalizeGlossaryPage(await get("mod_glossary_get_entries_by_letter", { ...page, letter: query.letter }));
				case "search":
					return normalizeGlossaryPage(await get("mod_glossary_get_entries_by_search", { ...page, query: query.text, fullsearch: 1, order: "CONCEPT", sort: "ASC" }));
				case "category":
					return normalizeGlossaryPage(await get("mod_glossary_get_entries_by_category", { ...page, categoryid: query.categoryId }));
				case "author":
					return normalizeGlossaryPage(await get("mod_glossary_get_entries_by_author", { ...page, letter: "ALL", field: "LASTNAME", sort: "ASC" }));
				case "date":
					return normalizeGlossaryPage(await get("mod_glossary_get_entries_by_date", { ...page, order: "UPDATE", sort: "DESC" }));
			}
		},
		async logGlossaryView(glossaryId) {
			await callMoodle(connection, "mod_glossary_view_glossary", { id: glossaryId, mode: "letter" }, "POST").catch(() => undefined);
		},
	};
}
