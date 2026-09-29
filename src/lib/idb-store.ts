import type { Entry, EntryStore } from "./swr-cache";

const DB_NAME = "moodleflow-cache";
const STORE = "entries";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	dbPromise ??= new Promise((resolve, reject) => {
		if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	dbPromise.catch(() => (dbPromise = null));
	return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const request = work(db.transaction(STORE, mode).objectStore(STORE));
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/** Persists cache entries in IndexedDB. Holds personal course data: clear() it on sign-in and sign-out. */
export const idbStore: EntryStore = {
	get: (key) => run<Entry | undefined>("readonly", (s) => s.get(key)),
	set: (key, entry) => run("readwrite", (s) => s.put(entry, key)).then(() => {}),
	deletePrefix: (prefix) =>
		run("readwrite", (s) => s.delete(IDBKeyRange.bound(prefix, `${prefix}￿`))).then(() => {}),
	clear: () => run("readwrite", (s) => s.clear()).then(() => {}),
};
