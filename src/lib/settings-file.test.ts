import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, sanitizePreferences } from "./preferences";
import { parseSettings, serializeSettings } from "./settings-file";

describe("settings file", () => {
	it("round-trips preferences through export and import", () => {
		const prefs = sanitizePreferences({ accent: "teal", noise: 0.6, dashboard: { stats: false } });
		expect(parseSettings(serializeSettings(prefs, "1.0.0"))).toEqual(prefs);
	});

	it("accepts a bare preferences object and sanitises it", () => {
		expect(parseSettings('{"accent":"pink","radius":"huge"}')).toMatchObject({ accent: "pink", radius: DEFAULT_PREFERENCES.radius });
	});

	it("rejects invalid JSON, non-objects and other apps' files", () => {
		expect(() => parseSettings("{nope")).toThrow("valid JSON");
		expect(() => parseSettings("[1,2]")).toThrow("doesn't contain");
		expect(() => parseSettings('{"app":"other","preferences":{}}')).toThrow("different app");
	});
});
