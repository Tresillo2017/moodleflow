import type { DatabaseEntry, DatabaseField, DatabaseSubmission } from "@/types/database";

/** Form state by control: `f12` for a field, `f12_1` for its second part (url text, longitude, alt). */
export type DatabaseFormValues = Record<string, string | string[] | File[]>;

export const MULTI_SEPARATOR = "##";
export const isFileField = (f: DatabaseField) => f.type === "file" || f.type === "picture";
/** Fields this form can't write; they stay as they are in Moodle. */
export const isEditable = (f: DatabaseField) => f.type !== "unsupported";

const key = (f: DatabaseField, part = 0) => (part ? `f${f.id}_${part}` : `f${f.id}`);
const toDateInput = (timestamp: string) => (Number(timestamp) > 0 ? new Date(Number(timestamp) * 1000).toISOString().slice(0, 10) : "");

/** Form state for a new entry (no `entry`) or an existing one. */
export function initialValues(fields: DatabaseField[], entry?: DatabaseEntry): DatabaseFormValues {
	const values: DatabaseFormValues = {};
	for (const f of fields) {
		const c = entry?.contents[f.id];
		if (f.type === "multimenu" || f.type === "checkbox") values[key(f)] = c?.content ? c.content.split(MULTI_SEPARATOR) : [];
		else if (f.type === "date") values[key(f)] = c ? toDateInput(c.content) : "";
		else if (isFileField(f)) {
			values[key(f)] = [];
			if (f.type === "picture") values[key(f, 1)] = c?.content1 ?? "";
		} else {
			values[key(f)] = c?.content ?? "";
			if (f.type === "url" || f.type === "latlong") values[key(f, 1)] = c?.content1 ?? "";
		}
	}
	return values;
}

const json = (v: unknown) => JSON.stringify(v);
const text = (values: DatabaseFormValues, k: string) => (typeof values[k] === "string" ? (values[k] as string) : "");
const list = (values: DatabaseFormValues, k: string) => (Array.isArray(values[k]) ? (values[k] as string[]) : []);

/** Titles of required fields the user hasn't filled in. `hasFile` says whether a file field already holds a file. */
export function missingFields(fields: DatabaseField[], values: DatabaseFormValues, hasFile: (f: DatabaseField) => boolean = () => false): string[] {
	return fields
		.filter((f) => f.required && isEditable(f))
		.filter((f) => {
			if (isFileField(f)) return (values[key(f)] as File[]).length === 0 && !hasFile(f);
			if (f.type === "multimenu" || f.type === "checkbox") return list(values, key(f)).length === 0;
			return text(values, key(f)).trim() === "";
		})
		.map((f) => f.name);
}

/**
 * The `data` list for mod_data_add_entry / update_entry. `uploads` maps file field ids to the draft area
 * their files were uploaded to; file fields without an upload are left out so existing files stay.
 */
export function buildSubmission(fields: DatabaseField[], values: DatabaseFormValues, uploads: Record<number, number> = {}): DatabaseSubmission[] {
	const out: DatabaseSubmission[] = [];
	for (const f of fields) {
		const k = key(f);
		const add = (value: unknown, subfield?: string) => out.push({ fieldid: f.id, subfield, value: json(value) });
		switch (f.type) {
			case "unsupported":
				break;
			case "multimenu":
			case "checkbox":
				add(list(values, k));
				break;
			case "textarea":
				add(text(values, k), "content");
				add(1, "content1"); // FORMAT_HTML
				break;
			case "url":
				add(text(values, k), "0");
				add(text(values, key(f, 1)), "1");
				break;
			case "latlong":
				add(text(values, k), "0");
				add(text(values, key(f, 1)), "1");
				break;
			case "date": {
				const [year, month, day] = text(values, k).split("-").map(Number);
				if (year && month && day) {
					add(day, "day");
					add(month, "month");
					add(year, "year");
				}
				break;
			}
			case "file":
			case "picture":
				if (uploads[f.id] !== undefined) {
					add(uploads[f.id], "file");
					if (f.type === "picture") add(text(values, key(f, 1)), "alt");
				}
				break;
			default:
				add(text(values, k));
		}
	}
	return out;
}
