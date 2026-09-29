import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, sanitizePreferences, togglePinned } from "./preferences";

describe("sanitizePreferences", () => {
	it("falls back to defaults for garbage input", () => {
		expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
		expect(sanitizePreferences("nope")).toEqual(DEFAULT_PREFERENCES);
	});

	it("keeps valid values and drops unknown ones", () => {
		const prefs = sanitizePreferences({
			accent: "teal",
			radius: "huge",
			font: "mono",
			constructor: "x",
			dashboard: { activity: false, calendar: "no", bogus: true },
		});
		expect(prefs.accent).toBe("teal");
		expect(prefs.radius).toBe(DEFAULT_PREFERENCES.radius);
		expect(prefs.font).toBe("mono");
		expect(prefs.dashboard).toEqual({ ...DEFAULT_PREFERENCES.dashboard, activity: false });
		expect(Object.keys(prefs).sort()).toEqual(Object.keys(DEFAULT_PREFERENCES).sort());
	});

	it("rejects inherited object keys as option values", () => {
		expect(sanitizePreferences({ accent: "toString" }).accent).toBe(DEFAULT_PREFERENCES.accent);
	});
});

describe("pinned courses", () => {
	it("toggles a pin on and off, keeping order", () => {
		expect(togglePinned([1, 2], 3)).toEqual([1, 2, 3]);
		expect(togglePinned([1, 2, 3], 2)).toEqual([1, 3]);
	});

	it("drops non-integer, non-positive and duplicate ids from stored data", () => {
		expect(sanitizePreferences({ pinnedCourses: [3, "4", 3, -1, 1.5, 7] }).pinnedCourses).toEqual([3, 7]);
		expect(sanitizePreferences({ pinnedCourses: "nope" }).pinnedCourses).toEqual([]);
	});
});
