import { callMoodle, type MoodleParams } from "./call";
import { normalizeDatabaseAccess, normalizeDatabaseFields, normalizeDatabasePage, normalizeDatabases } from "./normalize-database";
import { asRecord } from "./normalize";
import type { SocialContext } from "./client-social";
import type { Database, DatabaseAccess, DatabaseField, DatabasePage, DatabaseSubmission } from "@/types/database";

/** Database activities (Phase 5). */
export interface DatabaseApi {
	getDatabases(courseId: number): Promise<Database[]>;
	getDatabaseFields(databaseId: number): Promise<DatabaseField[]>;
	getDatabaseAccess(databaseId: number): Promise<DatabaseAccess>;
	/** The first `limit` entries; with `search`, only those matching it. */
	getDatabaseEntries(databaseId: number, search: string, limit: number): Promise<DatabasePage>;
	addDatabaseEntry(databaseId: number, data: DatabaseSubmission[]): Promise<number>;
	updateDatabaseEntry(entryId: number, data: DatabaseSubmission[]): Promise<void>;
	deleteDatabaseEntry(entryId: number): Promise<void>;
	approveDatabaseEntry(entryId: number, approve: boolean): Promise<void>;
	/** Tells Moodle the database was opened. Best effort. */
	logDatabaseView(databaseId: number): Promise<void>;
}

const dataList = (data: DatabaseSubmission[]): MoodleParams =>
	Object.fromEntries(data.map((d, i) => [i, { fieldid: d.fieldid, value: d.value, ...(d.subfield === undefined ? {} : { subfield: d.subfield }) }]));

export function createDatabaseApi({ connection }: SocialContext): DatabaseApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");

	return {
		async getDatabases(courseId) {
			return normalizeDatabases(await get("mod_data_get_databases_by_courses", { courseids: { 0: courseId } }));
		},
		async getDatabaseFields(databaseId) {
			return normalizeDatabaseFields(await get("mod_data_get_fields", { databaseid: databaseId }));
		},
		async getDatabaseAccess(databaseId) {
			return normalizeDatabaseAccess(await get("mod_data_get_data_access_information", { databaseid: databaseId }));
		},
		async getDatabaseEntries(databaseId, search, limit) {
			const page = { databaseid: databaseId, returncontents: 1, page: 0, perpage: limit };
			return normalizeDatabasePage(search ? await get("mod_data_search_entries", { ...page, search }) : await get("mod_data_get_entries", page));
		},
		async addDatabaseEntry(databaseId, data) {
			const added = asRecord(await post("mod_data_add_entry", { databaseid: databaseId, data: dataList(data) }));
			return Number(added.newentryid);
		},
		async updateDatabaseEntry(entryId, data) {
			await post("mod_data_update_entry", { entryid: entryId, data: dataList(data) });
		},
		async deleteDatabaseEntry(entryId) {
			await post("mod_data_delete_entry", { entryid: entryId });
		},
		async approveDatabaseEntry(entryId, approve) {
			await post("mod_data_approve_entry", { entryid: entryId, approve: approve ? 1 : 0 });
		},
		async logDatabaseView(databaseId) {
			await callMoodle(connection, "mod_data_view_database", { databaseid: databaseId }, "POST").catch(() => undefined);
		},
	};
}
