import { callMoodle, type MoodleParams } from "./call";
import { asRecord } from "./normalize";
import { blogAuthorIds, blogFilters, blogOptions, normalizeBlogPage, normalizeUserNames } from "./normalize-blog";
import type { SocialContext } from "./client-social";
import type { BlogAccess, BlogFilter, BlogInput, BlogPage } from "@/types/blog";

/** Blog entries (Phase 5). */
export interface BlogApi {
	getBlogAccess(): Promise<BlogAccess>;
	/** The first `limit` entries matching the filter, newest first. */
	getBlogEntries(filter: BlogFilter, limit: number): Promise<BlogPage>;
	addBlogEntry(input: BlogInput): Promise<number>;
	updateBlogEntry(entryId: number, input: BlogInput): Promise<void>;
	deleteBlogEntry(entryId: number): Promise<void>;
}

const pairs = (list: { name: string; value: string }[]): MoodleParams => Object.fromEntries(list.map((p, i) => [i, p]));

export function createBlogApi({ connection, userId }: SocialContext): BlogApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");
	const entryParams = (input: BlogInput): MoodleParams => ({ subject: input.subject, summary: input.html, summaryformat: 1, options: pairs(blogOptions(input)) });

	return {
		async getBlogAccess() {
			return { canCreate: Boolean(asRecord(await get("core_blog_get_access_information")).cancreate) };
		},
		async getBlogEntries(filter, limit) {
			const raw = await get("core_blog_get_entries", { filters: pairs(blogFilters(filter)), page: 0, perpage: limit });
			const ids = blogAuthorIds(raw);
			// entries only carry author ids; a site that hides profiles leaves "User 12"
			const names = ids.length ? await get("core_user_get_users_by_field", { field: "id", values: Object.fromEntries(ids.map((id, i) => [i, String(id)])) }).then(normalizeUserNames, () => new Map<number, string>()) : new Map<number, string>();
			return normalizeBlogPage(raw, names, await userId());
		},
		async addBlogEntry(input) {
			return Number(asRecord(await post("core_blog_add_entry", entryParams(input))).entryid);
		},
		async updateBlogEntry(entryId, input) {
			await post("core_blog_update_entry", { entryid: entryId, ...entryParams(input) });
		},
		async deleteBlogEntry(entryId) {
			await post("core_blog_delete_entry", { entryid: entryId });
		},
	};
}
