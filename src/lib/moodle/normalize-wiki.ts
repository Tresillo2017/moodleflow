import type { MoodleFile } from "@/types/moodle";
import type { Subwiki, Wiki, WikiPage, WikiPageSummary } from "@/types/wiki";
import { asArray, asRecord } from "./normalize";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const time = (seconds: unknown) => (Number(seconds) > 0 ? new Date(Number(seconds) * 1000).toISOString() : undefined);

// mod_wiki_get_wikis_by_courses
export function normalizeWikis(raw: unknown): Wiki[] {
	return asArray(asRecord(raw).wikis).map((w) => {
		const r = asRecord(w);
		return {
			id: Number(r.id),
			cmid: Number(r.coursemodule ?? 0),
			courseId: Number(r.course ?? 0),
			name: String(r.name ?? ""),
			intro: str(r.intro),
			firstPageTitle: String(r.firstpagetitle || "First page"),
			mode: r.wikimode === "individual" ? "individual" : "collaborative",
		};
	});
}

// mod_wiki_get_subwikis
export function normalizeSubwikis(raw: unknown): Subwiki[] {
	return asArray(asRecord(raw).subwikis).map((s) => {
		const r = asRecord(s);
		return {
			id: Number(r.id),
			wikiId: Number(r.wikiid),
			groupId: Number(r.groupid ?? 0),
			userId: Number(r.userid ?? 0),
			canEdit: Boolean(r.canedit),
		};
	});
}

const summary = (r: Record<string, unknown>): WikiPageSummary => ({
	id: Number(r.id),
	subwikiId: Number(r.subwikiid),
	title: String(r.title ?? ""),
	modified: time(r.timemodified),
});

// mod_wiki_get_subwiki_pages, first page first, then alphabetical
export function normalizeWikiPages(raw: unknown, firstPageTitle: string): WikiPageSummary[] {
	return asArray(asRecord(raw).pages)
		.map((p) => summary(asRecord(p)))
		.sort((a, b) => Number(b.title === firstPageTitle) - Number(a.title === firstPageTitle) || a.title.localeCompare(b.title));
}

// mod_wiki_get_page_contents
export function normalizeWikiPage(raw: unknown): WikiPage {
	const r = asRecord(asRecord(raw).page);
	return {
		...summary(r),
		subwikiId: Number(r.subwikiid),
		html: String(r.cachedcontent ?? ""),
		canEdit: Boolean(r.caneditpage),
		version: Number(r.version ?? 0),
	};
}

// mod_wiki_get_subwiki_files
export function normalizeWikiFiles(raw: unknown): MoodleFile[] {
	return asArray(asRecord(raw).files)
		.map(asRecord)
		.filter((f) => typeof f.fileurl === "string")
		.map((f) => ({
			name: String(f.filename ?? ""),
			url: String(f.fileurl),
			size: Number(f.filesize ?? 0),
			mimeType: str(f.mimetype),
		}));
}

/** Page id a wiki-internal link points at (`view.php?pageid=12`), or null for anything else. */
export function wikiLinkPageId(href: string | null | undefined): number | null {
	if (!href) return null;
	try {
		const url = new URL(href, "https://moodle.invalid");
		if (!url.pathname.endsWith("/mod/wiki/view.php")) return null;
		const id = Number(url.searchParams.get("pageid"));
		return Number.isInteger(id) && id > 0 ? id : null;
	} catch {
		return null;
	}
}
