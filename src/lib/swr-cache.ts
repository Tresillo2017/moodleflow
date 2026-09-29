/** Where cache entries persist between sessions (IndexedDB in the app, a Map in tests). */
export interface EntryStore {
	get(key: string): Promise<Entry | undefined>;
	set(key: string, entry: Entry): Promise<void>;
	deletePrefix(prefix: string): Promise<void>;
	clear(): Promise<void>;
}

export interface Entry {
	value: unknown;
	at: number;
}

/**
 * Stale-while-revalidate cache for read calls. Fresh entries (younger than the TTL) are returned as is;
 * older ones are returned immediately and refetched in the background, then `onUpdate` fires.
 * Failed reads are never cached, so offline reloads still show whatever was persisted.
 */
export function createSwrCache(store: EntryStore | null, onUpdate: () => void = () => {}, now: () => number = Date.now) {
	const memory = new Map<string, Entry>();
	const inflight = new Map<string, Promise<unknown>>();

	function load<T>(key: string, run: () => Promise<T>): Promise<T> {
		const existing = inflight.get(key) as Promise<T> | undefined;
		if (existing) return existing;
		const request = run()
			.then((value) => {
				const entry = { value, at: now() };
				memory.set(key, entry);
				void store?.set(key, entry).catch(() => {});
				return value;
			})
			.finally(() => inflight.delete(key));
		inflight.set(key, request);
		return request;
	}

	function cached<A extends unknown[], T>(name: string, ttlMs: number, fn: (...args: A) => Promise<T>) {
		return async (...args: A): Promise<T> => {
			const key = `${name}:${JSON.stringify(args)}`;
			let entry = memory.get(key);
			if (!entry && store) {
				entry = await store.get(key).catch(() => undefined);
				if (entry && !memory.has(key)) memory.set(key, entry);
			}
			if (!entry) return load(key, () => fn(...args));
			if (now() - entry.at > ttlMs) {
				load(key, () => fn(...args)).then(onUpdate, () => {});
			}
			return entry.value as T;
		};
	}

	/** Drops every entry of one resource (call after a mutation touches it). */
	function invalidate(name: string) {
		const prefix = `${name}:`;
		for (const key of [...memory.keys()]) if (key.startsWith(prefix)) memory.delete(key);
		for (const key of [...inflight.keys()]) if (key.startsWith(prefix)) inflight.delete(key);
		void store?.deletePrefix(prefix).catch(() => {});
	}

	async function clear() {
		memory.clear();
		inflight.clear();
		await store?.clear().catch(() => {});
	}

	return { cached, invalidate, clear };
}
