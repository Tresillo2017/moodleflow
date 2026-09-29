import { describe, expect, it } from "vitest";
import { notesToShow } from "./whats-new";

const release = { version: "0.6.0", groups: [{ title: "Added", items: ["A"] }] };

describe("notesToShow", () => {
	it("shows the notes once the pending version is running", () => {
		expect(notesToShow("0.6.0", "0.6.0", release)).toBe(release);
	});

	it("shows nothing without a pending update, or if the reload didn't land on it", () => {
		expect(notesToShow(null, "0.6.0", release)).toBeNull();
		expect(notesToShow("0.6.0", "0.5.2", { ...release, version: "0.5.2" })).toBeNull();
		expect(notesToShow("0.6.0", "0.6.0", null)).toBeNull();
	});
});
