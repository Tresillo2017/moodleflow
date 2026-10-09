import type { Glossary, GlossaryBrowseMode, GlossaryCategory, GlossaryEntry, GlossaryPage } from "@/types/glossary";
import { asArray, asRecord } from "./normalize";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const time = (seconds: unknown) => (Number(seconds) > 0 ? new Date(Number(seconds) * 1000).toISOString() : undefined);

const MODES: Record<string, GlossaryBrowseMode> = { letter: "letter", cat: "category", author: "author", date: "date" };

// mod_glossary_get_glossaries_by_courses
export function normalizeGlossaries(raw: unknown): Glossary[] {
	return asArray(asRecord(raw).glossaries).map((g) => {
		const r = asRecord(g);
		const modes = asArray(r.browsemodes).flatMap((m) => MODES[String(m)] ?? []);
		return {
			id: Number(r.id),
			cmid: Number(r.coursemodule ?? 0),
			courseId: Number(r.course ?? 0),
			name: String(r.name ?? ""),
			intro: str(r.intro),
			// a site that omits the list still supports the alphabet
			browseModes: modes.length > 0 ? modes : ["letter"],
			canAddEntry: Boolean(r.canaddentry),
		};
	});
}

// mod_glossary_get_categories
export function normalizeGlossaryCategories(raw: unknown): GlossaryCategory[] {
	return asArray(asRecord(raw).categories).map((c) => {
		const r = asRecord(c);
		return { id: Number(r.id), name: String(r.name ?? "") };
	});
}

export function normalizeGlossaryEntry(raw: unknown): GlossaryEntry {
	const r = asRecord(raw);
	return {
		id: Number(r.id),
		glossaryId: Number(r.glossaryid ?? 0),
		concept: String(r.concept ?? ""),
		definition: String(r.definition ?? ""),
		author: String(r.userfullname ?? ""),
		userId: Number(r.userid ?? 0),
		created: time(r.timecreated),
		modified: time(r.timemodified),
		approved: r.approved === undefined ? true : Boolean(r.approved),
		canEdit: Boolean(r.canupdate),
		canDelete: Boolean(r.candelete),
	};
}

// mod_glossary_get_entries_by_* : { count, entries }
export function normalizeGlossaryPage(raw: unknown): GlossaryPage {
	const r = asRecord(raw);
	const entries = asArray(r.entries).map(normalizeGlossaryEntry);
	return { entries, total: Number(r.count ?? entries.length) };
}
