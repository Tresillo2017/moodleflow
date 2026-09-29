import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./paging";

describe("fetchAllPages", () => {
	it("stops at the first short page", async () => {
		const data = [1, 2, 3, 4, 5];
		const calls: number[] = [];
		const all = await fetchAllPages(async (page) => (calls.push(page), data.slice(page * 2, page * 2 + 2)), 2);
		expect(all).toEqual(data);
		expect(calls).toEqual([0, 1, 2]);
	});

	it("handles an empty first page", async () => {
		expect(await fetchAllPages(async () => [], 10)).toEqual([]);
	});
});
