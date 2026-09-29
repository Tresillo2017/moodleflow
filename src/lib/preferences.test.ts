import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, sanitizePreferences } from "./preferences";

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
