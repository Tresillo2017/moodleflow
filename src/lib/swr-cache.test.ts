import { describe, expect, it, vi } from "vitest";
import { createSwrCache, type Entry, type EntryStore } from "./swr-cache";

function memoryStore(): EntryStore & { data: Map<string, Entry> } {
	const data = new Map<string, Entry>();
	return {
		data,
		get: async (k) => data.get(k),
		set: async (k, e) => void data.set(k, e),
		deletePrefix: async (p) => void [...data.keys()].filter((k) => k.startsWith(p)).forEach((k) => data.delete(k)),
		clear: async () => data.clear(),
	};
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createSwrCache", () => {
	it("serves fresh entries without refetching", async () => {
		const fn = vi.fn().mockResolvedValue("a");
		const { cached } = createSwrCache(null);
		const get = cached("x", 1000, fn);
		await get();
		await get();
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("returns stale data instantly, revalidates and notifies", async () => {
		let time = 0;
		let value = "old";
		const onUpdate = vi.fn();
		const get = createSwrCache(null, onUpdate, () => time).cached("x", 1000, async () => value);
		expect(await get()).toBe("old");
		time = 5000;
		value = "new";
		expect(await get()).toBe("old");
		await flush();
		expect(onUpdate).toHaveBeenCalledTimes(1);
		expect(await get()).toBe("new");
	});

	it("shows persisted data after a reload even when the network fails", async () => {
		const store = memoryStore();
		let time = 0;
		await createSwrCache(store, undefined, () => time).cached("x", 1000, async () => "saved")();
		time = 9999;
		const reloaded = createSwrCache(store, undefined, () => time).cached("x", 1000, async () => {
			throw new Error("offline");
		});
		expect(await reloaded()).toBe("saved");
	});

	it("does not cache failures", async () => {
		const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
		const get = createSwrCache(null).cached("x", 1000, fn);
		await expect(get()).rejects.toThrow("boom");
		expect(await get()).toBe("ok");
	});

	it("invalidate forces the next read to refetch, in memory and in the store", async () => {
		const store = memoryStore();
		let n = 0;
		const cache = createSwrCache(store);
		const get = cache.cached("x", 1e9, async () => ++n);
		expect(await get()).toBe(1);
		await flush();
		cache.invalidate("x");
		expect(store.data.size).toBe(0);
		expect(await get()).toBe(2);
	});
});
