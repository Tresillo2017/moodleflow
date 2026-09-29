import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, activeSeason, hueOf, sanitizePreferences, seasonForDate, togglePinned } from "./preferences";

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

describe("custom hue and glass", () => {
	it("normalises the custom hue and rejects non-numbers", () => {
		expect(sanitizePreferences({ hue: 400 }).hue).toBe(40);
		expect(sanitizePreferences({ hue: -10 }).hue).toBe(350);
		expect(sanitizePreferences({ hue: "red" }).hue).toBeNull();
	});

	it("hueOf prefers the custom hue over the accent", () => {
		expect(hueOf({ accent: "teal", hue: null, season: "none" })).toBe(190);
		expect(hueOf({ accent: "teal", hue: 12, season: "none" })).toBe(12);
	});

	it("validates glass, vibrance and weight", () => {
		const prefs = sanitizePreferences({ glass: "strong", vibrance: "neon", weight: "medium" });
		expect(prefs.glass).toBe("strong");
		expect(prefs.vibrance).toBe(DEFAULT_PREFERENCES.vibrance);
		expect(prefs.weight).toBe("medium");
	});
});

describe("seasons", () => {
	it("maps dates to bleh-style seasons", () => {
		expect(seasonForDate(new Date(2026, 11, 25))).toBe("christmas");
		expect(seasonForDate(new Date(2026, 9, 31))).toBe("halloween");
		expect(seasonForDate(new Date(2026, 0, 1))).toBe("new_years");
		expect(seasonForDate(new Date(2026, 4, 10))).toBeNull();
	});

	it("activeSeason honours off, a forced season and rejects unknown values", () => {
		expect(activeSeason({ season: "none" }, new Date(2026, 11, 25))).toBeNull();
		expect(activeSeason({ season: "auto" }, new Date(2026, 11, 25))).toBe("christmas");
		expect(activeSeason({ season: "fall" }, new Date(2026, 4, 10))).toBe("fall");
		expect(sanitizePreferences({ season: "toString" }).season).toBe("none");
	});

	it("a season shifts the hue unless a custom hue is set", () => {
		expect(hueOf({ accent: "violet", hue: null, season: "halloween" })).toBe(35);
		expect(hueOf({ accent: "violet", hue: 200, season: "halloween" })).toBe(200);
	});
});
