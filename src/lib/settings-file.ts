import { sanitizePreferences, type Preferences } from "@/lib/preferences";

const APP = "moodleflow";

/** The JSON written by Export: the preferences plus which app and version made them. */
export function serializeSettings(prefs: Preferences, version: string | undefined): string {
	return JSON.stringify({ app: APP, version, preferences: prefs }, null, "\t");
}

/** Reads an exported file (or a bare preferences object); unknown keys and bad values fall back to defaults. */
export function parseSettings(text: string): Preferences {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error("That file isn't valid JSON.");
	}
	if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("That file doesn't contain MoodleFlow settings.");
	const wrapped = data as { app?: unknown; preferences?: unknown };
	if (wrapped.app !== undefined && wrapped.app !== APP) throw new Error("That file was exported from a different app.");
	return sanitizePreferences(wrapped.preferences ?? data);
}
