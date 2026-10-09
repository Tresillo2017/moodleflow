import type { MoodleFile } from "@/types/moodle";
import type { Database, DatabaseAccess, DatabaseContent, DatabaseEntry, DatabaseField, DatabaseFieldType, DatabasePage } from "@/types/database";
import { asArray, asRecord } from "./normalize";
import { normalizeRatings } from "./normalize-rating";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const time = (seconds: unknown) => (Number(seconds) > 0 ? new Date(Number(seconds) * 1000).toISOString() : undefined);

// mod_data_get_databases_by_courses
export function normalizeDatabases(raw: unknown): Database[] {
	return asArray(asRecord(raw).databases).map((d) => {
		const r = asRecord(d);
		return {
			id: Number(r.id),
			cmid: Number(r.coursemodule ?? 0),
			courseId: Number(r.course ?? 0),
			name: String(r.name ?? ""),
			intro: str(r.intro),
			requiresApproval: Boolean(r.approval),
			assessed: Number(r.assessed ?? 0),
			allowComments: Boolean(r.comments),
			timeOpen: time(r.timeavailablefrom),
			timeClose: time(r.timeavailableto),
		};
	});
}

const TYPES: DatabaseFieldType[] = ["text", "textarea", "number", "url", "latlong", "menu", "multimenu", "radiobutton", "checkbox", "date", "picture", "file"];

// mod_data_get_fields: choices live in param1, one per line
export function normalizeDatabaseFields(raw: unknown): DatabaseField[] {
	return asArray(asRecord(raw).fields).map((f) => {
		const r = asRecord(f);
		const type = TYPES.find((t) => t === r.type) ?? "unsupported";
		return {
			id: Number(r.id),
			type,
			name: String(r.name ?? ""),
			description: str(r.description),
			required: Boolean(r.required),
			options: ["menu", "multimenu", "radiobutton", "checkbox"].includes(type)
				? String(r.param1 ?? "").split(/\r?\n/).map((o) => o.trim()).filter(Boolean)
				: [],
		};
	});
}

function normalizeFiles(raw: unknown): MoodleFile[] {
	return asArray(raw)
		.map(asRecord)
		.filter((f) => typeof f.fileurl === "string")
		.map((f) => ({ name: String(f.filename ?? ""), url: String(f.fileurl), size: Number(f.filesize ?? 0), mimeType: str(f.mimetype) }));
}

function normalizeEntry(raw: unknown): DatabaseEntry {
	const r = asRecord(raw);
	const contents: Record<number, DatabaseContent> = {};
	for (const c of asArray(r.contents).map(asRecord)) {
		contents[Number(c.fieldid)] = { content: String(c.content ?? ""), content1: str(c.content1), files: normalizeFiles(c.files) };
	}
	return {
		id: Number(r.id),
		userId: Number(r.userid ?? 0),
		author: String(r.fullname ?? ""),
		created: time(r.timecreated),
		modified: time(r.timemodified),
		approved: r.approved === undefined ? true : Boolean(r.approved),
		canManage: Boolean(r.canmanageentry),
		contents,
	};
}

// mod_data_get_entries / mod_data_search_entries
export function normalizeDatabasePage(raw: unknown): DatabasePage {
	const r = asRecord(raw);
	const entries = asArray(r.entries).map(normalizeEntry);
	return { entries, total: Number(r.totalcount ?? entries.length), ratings: Object.fromEntries(normalizeRatings(r.ratinginfo)) };
}

// mod_data_get_data_access_information
export function normalizeDatabaseAccess(raw: unknown): DatabaseAccess {
	const r = asRecord(raw);
	// the capability alone isn't enough: the entry limit may be used up or the activity closed
	return { canAdd: Boolean(r.canaddentry) && r.entrieslefttoadd !== 0 && r.timeavailable !== false, canApprove: Boolean(r.canapprove) };
}
