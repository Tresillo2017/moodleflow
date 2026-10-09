import { describe, expect, it } from "vitest";
import { normalizeCommentPage } from "./normalize-comments";
import { normalizeRatings } from "./normalize-rating";

describe("comments", () => {
	it("maps comments with delete rights and paging info", () => {
		const page = normalizeCommentPage({ count: 31, perpage: 15, canpost: true, comments: [{ id: 4, fullname: "Ana", content: "<p>Hi</p>", timecreated: 100, delete: true }, { id: 5, content: "x" }] });
		expect(page).toMatchObject({ count: 31, perPage: 15, canPost: true });
		expect(page.comments[0]).toMatchObject({ id: 4, author: "Ana", canDelete: true });
		expect(page.comments[1].canDelete).toBe(false);
	});

	it("defaults to being allowed to post when the site doesn't say", () => {
		expect(normalizeCommentPage({ comments: [] }).canPost).toBe(true);
	});
});

describe("ratings", () => {
	it("builds options from the scale and hides aggregates the user can't see", () => {
		const m = normalizeRatings({ scales: [{ id: -5, max: 5 }], ratings: [{ itemid: 9, scaleid: -5, canrate: 1, rating: 4, aggregatestr: "3.5", count: 2 }, { itemid: 10, scaleid: -5, canviewaggregate: false, aggregatestr: "9", rating: 0 }] });
		expect(m.get(9)).toMatchObject({ canRate: true, mine: 4, aggregate: "3.5", count: 2 });
		expect(m.get(9)?.options).toHaveLength(5);
		expect(m.get(10)).toMatchObject({ aggregate: undefined, mine: undefined });
	});

	it("skips items whose scale has no options", () => {
		expect(normalizeRatings({ scales: [], ratings: [{ itemid: 1, scaleid: 0 }] }).size).toBe(0);
		expect(normalizeRatings(undefined).size).toBe(0);
	});
});
