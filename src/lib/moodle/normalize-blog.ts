import type { MoodleFile } from "@/types/moodle";
import type { BlogEntry, BlogFilter, BlogInput, BlogPage, BlogPublishState } from "@/types/blog";
import { asArray, asRecord } from "./normalize";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const time = (seconds: unknown) => (Number(seconds) > 0 ? new Date(Number(seconds) * 1000).toISOString() : undefined);
const STATES: BlogPublishState[] = ["draft", "site", "public"];

function normalizeFiles(raw: unknown): MoodleFile[] {
	return asArray(raw)
		.map(asRecord)
		.filter((f) => typeof f.fileurl === "string")
		.map((f) => ({ name: String(f.filename ?? ""), url: String(f.fileurl), size: Number(f.filesize ?? 0), mimeType: str(f.mimetype) }));
}

/** core_blog_get_entries; `names` maps user ids to full names, `me` is the signed-in user's id. */
export function normalizeBlogPage(raw: unknown, names: Map<number, string>, me: number): BlogPage {
	const r = asRecord(raw);
	const entries = asArray(r.entries).map((e): BlogEntry => {
		const entry = asRecord(e);
		const userId = Number(entry.userid);
		return {
			id: Number(entry.id),
			userId,
			author: names.get(userId) ?? `User ${userId}`,
			subject: String(entry.subject ?? ""),
			html: String(entry.summary ?? ""),
			tags: asArray(entry.tags).map((t) => String(asRecord(t).rawname ?? "")).filter(Boolean),
			publishState: STATES.find((s) => s === entry.publishstate) ?? "site",
			created: time(entry.created),
			modified: time(entry.lastmodified),
			attachments: normalizeFiles(entry.attachmentfiles),
			canEdit: userId === me,
		};
	});
	return { entries, total: Number(r.totalentries ?? entries.length) };
}

/** Ids of the entries' authors, for looking their names up. */
export function blogAuthorIds(raw: unknown): number[] {
	return [...new Set(asArray(asRecord(raw).entries).map((e) => Number(asRecord(e).userid)).filter((id) => id > 0))];
}

// core_user_get_users_by_field
export function normalizeUserNames(raw: unknown): Map<number, string> {
	return new Map(asArray(raw).map(asRecord).map((u) => [Number(u.id), String(u.fullname ?? "")] as const));
}

/** core_blog_get_entries `filters`: Moodle wants name/value pairs. */
export function blogFilters(filter: BlogFilter): { name: string; value: string }[] {
	const out: { name: string; value: string }[] = [];
	if (filter.userId) out.push({ name: "userid", value: String(filter.userId) });
	if (filter.courseId) out.push({ name: "courseid", value: String(filter.courseId) });
	if (filter.tag) out.push({ name: "tag", value: filter.tag });
	return out;
}

/** core_blog_add_entry / update_entry `options` as name/value pairs. */
export function blogOptions(input: BlogInput): { name: string; value: string }[] {
	return [
		{ name: "publishstate", value: input.publishState },
		{ name: "tags", value: input.tags.join(",") },
	];
}

/** "a, b ,,c" → ["a","b","c"] */
export const parseTags = (text: string) => [...new Set(text.split(",").map((t) => t.trim()).filter(Boolean))];
