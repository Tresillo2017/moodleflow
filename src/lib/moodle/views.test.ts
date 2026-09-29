import { describe, expect, it } from "vitest";
import { viewCall } from "./views";

describe("viewCall", () => {
	it("maps an activity to its view function", () => {
		expect(viewCall({ type: "page", instance: 7 })).toEqual({ wsfunction: "mod_page_view_page", params: { pageid: 7 } });
	});

	it("marks feedback as viewed", () => {
		expect(viewCall({ type: "feedback", instance: 2 })?.params).toEqual({ feedbackid: 2, moduleviewed: true });
	});

	it("returns null for untracked or id-less activities", () => {
		expect(viewCall({ type: "label", instance: 1 })).toBeNull();
		expect(viewCall({ type: "page" })).toBeNull();
	});
});
