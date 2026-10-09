import { mockRating } from "./mock-collab";
import type { DatabaseApi } from "./client-database";
import type { Database, DatabaseContent, DatabaseEntry, DatabaseField, DatabaseSubmission } from "@/types/database";

const wait = <T>(value: T, ms = 200): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));

const databases: Database[] = [
	{ id: 1, cmid: 42, courseId: 1, name: "Project ideas", intro: "<p>Share a project idea and pick one to build.</p>", requiresApproval: true, assessed: 1, allowComments: true },
];
const fields: DatabaseField[] = [
	{ id: 1, type: "text", name: "Title", required: true, options: [] },
	{ id: 2, type: "textarea", name: "Description", required: false, options: [] },
	{ id: 3, type: "menu", name: "Difficulty", required: true, options: ["Easy", "Medium", "Hard"] },
	{ id: 4, type: "checkbox", name: "Topics", required: false, options: ["Series", "Integrals", "Matrices"] },
	{ id: 5, type: "url", name: "Reference", required: false, options: [] },
	{ id: 6, type: "date", name: "Deadline", required: false, options: [] },
];
const content = (c: string, c1?: string): DatabaseContent => ({ content: c, content1: c1, files: [] });
let nextId = 3;
const entries: DatabaseEntry[] = [
	{ id: 1, userId: 2, author: "Ana Costa", approved: true, canManage: false, created: new Date(Date.now() - 3 * 86_400_000).toISOString(), contents: { 1: content("Eigenvalue visualiser"), 2: content("<p>Plot how a matrix transforms the unit circle.</p>"), 3: content("Medium"), 4: content("Matrices##Series"), 5: content("https://example.com/eigen", "3Blue1Brown"), 6: content("1792000000") } },
	{ id: 2, userId: 1, author: "Tomas", approved: false, canManage: true, created: new Date(Date.now() - 86_400_000).toISOString(), contents: { 1: content("Series convergence quiz"), 3: content("Easy"), 4: content("Series") } },
];

const fromSubmission = (data: DatabaseSubmission[]): Record<number, DatabaseContent> => {
	const out: Record<number, DatabaseContent> = {};
	for (const d of data) {
		const value = JSON.parse(d.value) as unknown;
		const c = (out[d.fieldid] ??= content(""));
		if (d.subfield === "1") c.content1 = String(value);
		else if (d.subfield === "content1") continue;
		else if (["day", "month", "year"].includes(d.subfield ?? "")) c.content = c.content || String(Date.now() / 1000);
		else c.content = Array.isArray(value) ? value.join("##") : String(value);
	}
	return out;
};

export function createMockDatabaseApi(): DatabaseApi {
	return {
		getDatabases: (courseId) => wait(databases.filter((d) => d.courseId === courseId)),
		getDatabaseFields: () => wait(fields),
		getDatabaseAccess: () => wait({ canAdd: true, canApprove: true }),
		getDatabaseEntries: (_id, search, limit) => {
			const q = search.toLowerCase();
			const found = entries.filter((e) => !q || Object.values(e.contents).some((c) => c.content.toLowerCase().includes(q)));
			const shown = found.slice(0, limit);
			return wait({ entries: shown, total: found.length, ratings: Object.fromEntries(shown.map((e) => [e.id, mockRating("mod_data", "entry", e.id)])) });
		},
		addDatabaseEntry: (_id, data) => {
			const id = nextId++;
			entries.unshift({ id, userId: 1, author: "Tomas", approved: false, canManage: true, created: new Date().toISOString(), contents: fromSubmission(data) });
			return wait(id);
		},
		updateDatabaseEntry: (entryId, data) => {
			const i = entries.findIndex((e) => e.id === entryId);
			if (i >= 0) entries[i] = { ...entries[i], modified: new Date().toISOString(), contents: { ...entries[i].contents, ...fromSubmission(data) } };
			return wait(undefined);
		},
		deleteDatabaseEntry: (entryId) => {
			const i = entries.findIndex((e) => e.id === entryId);
			if (i >= 0) entries.splice(i, 1);
			return wait(undefined);
		},
		approveDatabaseEntry: (entryId, approve) => {
			const i = entries.findIndex((e) => e.id === entryId);
			if (i >= 0) entries[i] = { ...entries[i], approved: approve };
			return wait(undefined);
		},
		logDatabaseView: () => wait(undefined, 0),
	};
}
