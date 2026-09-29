/**
 * UI preferences, stored per-browser in localStorage alongside the Moodle connection.
 * Appearance keys are applied as data attributes / CSS variables on <html> (see globals.css),
 * both by PREFERENCES_SCRIPT before first paint and by the provider on change.
 */

import type { DitherColor } from "@/components/dither-kit/palette";

const STORAGE_KEY = "moodleflow.preferences";

/**
 * `hue` drives the oklch theme tokens; `ditherHue` is the HSL hue dither-kit gradients expect;
 * `chart` is the closest named dither-kit series colour (charts only take palette names).
 */
export const ACCENTS = {
	indigo: { label: "Indigo", hue: 264, ditherHue: 235, chart: "purple" },
	blue: { label: "Blue", hue: 245, ditherHue: 212, chart: "blue" },
	violet: { label: "Violet", hue: 295, ditherHue: 268, chart: "purple" },
	pink: { label: "Pink", hue: 350, ditherHue: 325, chart: "pink" },
	rose: { label: "Rose", hue: 15, ditherHue: 352, chart: "red" },
	orange: { label: "Orange", hue: 50, ditherHue: 24, chart: "orange" },
	amber: { label: "Amber", hue: 80, ditherHue: 40, chart: "orange" },
	green: { label: "Green", hue: 150, ditherHue: 140, chart: "green" },
	teal: { label: "Teal", hue: 190, ditherHue: 175, chart: "blue" },
} as const satisfies Record<string, { label: string; hue: number; ditherHue: number; chart: DitherColor }>;

export type Accent = keyof typeof ACCENTS;

/** Every single-choice preference with its options (value → label). Also the source of truth for validation. */
export const CHOICES = {
	darkStyle: { black: "Black", dim: "Dim" },
	radius: { none: "None", sm: "Small", md: "Medium", lg: "Large" },
	font: { bleh: "Hanken Grotesk", system: "System", serif: "Serif", mono: "Mono" },
	palette: { bleh: "bleh", rose_pine: "Rosé Pine", kanagawa: "Kanagawa", ink: "Ink" },
	season: {
		none: "Off",
		auto: "Automatic",
		new_years: "New Year",
		easter: "Easter",
		pride: "Pride",
		summer: "Summer",
		pre_fall: "Late summer",
		fall: "Fall",
		halloween: "Halloween",
		christmas: "Christmas",
	},
	particles: { on: "On", off: "Off" },
	glass: { off: "Off", soft: "Soft", strong: "Strong" },
	vibrance: { muted: "Muted", normal: "Normal", vivid: "Vivid" },
	weight: { light: "Light", normal: "Regular", medium: "Medium" },
	scale: { sm: "Small", md: "Default", lg: "Large", xl: "Larger" },
	motion: { system: "Follow system", reduced: "Reduced" },
	sidebar: { sidebar: "Standard", floating: "Floating", inset: "Inset" },
	width: { normal: "Normal", wide: "Wide", full: "Full" },
	weekStart: { sunday: "Sunday", monday: "Monday" },
	clock: { auto: "Auto", "12h": "12-hour", "24h": "24-hour" },
} as const;

export type ChoiceKey = keyof typeof CHOICES;

export const DASHBOARD_SECTIONS = {
	stats: "Summary",
	upcoming: "Upcoming deadlines",
	courses: "Starred courses",
	activity: "Activity heatmap",
	calendar: "Calendar",
} as const;

export type DashboardSection = keyof typeof DASHBOARD_SECTIONS;

export type Preferences = { [K in ChoiceKey]: keyof (typeof CHOICES)[K] } & {
	accent: Accent;
	/** Custom accent hue (0-359) that overrides the accent preset; null uses the preset. */
	hue: number | null;
	dashboard: Record<DashboardSection, boolean>;
	/** Course ids pinned to the top of the sidebar, in display order. */
	pinnedCourses: number[];
};

export const DEFAULT_PREFERENCES: Preferences = {
	accent: "violet",
	hue: null,
	palette: "bleh",
	season: "none",
	particles: "on",
	glass: "soft",
	vibrance: "normal",
	weight: "normal",
	darkStyle: "black",
	radius: "md",
	font: "bleh",
	scale: "md",
	motion: "system",
	sidebar: "sidebar",
	width: "normal",
	weekStart: "monday",
	clock: "auto",
	dashboard: { stats: true, upcoming: true, courses: true, activity: true, calendar: true },
	pinnedCourses: [],
};

const APPEARANCE_KEYS = ["darkStyle", "radius", "font", "scale", "motion", "glass", "vibrance", "weight", "palette", "particles"] as const;

const HUES = Object.fromEntries(Object.entries(ACCENTS).map(([key, a]) => [key, a.hue]));

function sanitizeHue(raw: unknown): number | null {
	return typeof raw === "number" && Number.isFinite(raw) ? ((Math.round(raw) % 360) + 360) % 360 : null;
}

/** Seasonal looks, after bleh: `sat` scales vibrance, `emoji` is what the particle overlay drops. */
export const SEASONS = {
	new_years: { hue: 324, sat: 1.88, emoji: "✦" },
	easter: { hue: 114, sat: 1.16, emoji: "🌷" },
	pride: { hue: 276, sat: 1.58, emoji: "" },
	summer: { hue: 43, sat: 2.39, emoji: "☀️" },
	pre_fall: { hue: 43, sat: 1.65, emoji: "🌻" },
	fall: { hue: 256, sat: 0.92, emoji: "🍂" },
	halloween: { hue: 35, sat: 1.75, emoji: "🎃" },
	christmas: { hue: 19, sat: 2.36, emoji: "❄️" },
} as const;

export type SeasonName = keyof typeof SEASONS;

/** Self-contained (serialized into PREFERENCES_SCRIPT). Approximate calendar windows; Easter is fixed to Mar 20 - Apr 25. */
export function seasonForDate(d: Date): string | null {
	const md = (d.getMonth() + 1) * 100 + d.getDate();
	if (md >= 1231 || md <= 102) return "new_years";
	if (md >= 1201) return "christmas";
	if (md >= 1015 && md <= 1101) return "halloween";
	if (md >= 922 && md < 1015) return "fall";
	if (md >= 815 && md < 922) return "pre_fall";
	if (md >= 701 && md < 815) return "summer";
	if (md >= 601 && md < 701) return "pride";
	if (md >= 320 && md <= 425) return "easter";
	return null;
}

/** The season in effect (null when off or out of season). */
export function activeSeason(prefs: Pick<Preferences, "season">, now: Date = new Date()): SeasonName | null {
	const name = prefs.season === "auto" ? seasonForDate(now) : prefs.season === "none" ? null : prefs.season;
	return name && Object.hasOwn(SEASONS, name) ? (name as SeasonName) : null;
}

/** The hue driving the theme: custom hue, then the season's, then the accent preset's. */
export function hueOf(prefs: Pick<Preferences, "accent" | "hue" | "season">): number {
	const season = activeSeason(prefs);
	return prefs.hue ?? (season ? SEASONS[season].hue : ACCENTS[prefs.accent].hue);
}

/** dither-kit wants an HSL hue; the oklch hue sits ~27 degrees ahead of it across the presets. */
export function ditherHueOf(prefs: Pick<Preferences, "accent" | "hue" | "season">): number {
	return prefs.hue === null && !activeSeason(prefs) ? ACCENTS[prefs.accent].ditherHue : (hueOf(prefs) + 333) % 360;
}

/** Charts only take named palette colours, so a custom hue maps to the nearest preset's. */
export function chartOf(prefs: Pick<Preferences, "accent" | "hue" | "season">): DitherColor {
	if (prefs.hue === null && !activeSeason(prefs)) return ACCENTS[prefs.accent].chart;
	const hue = hueOf(prefs);
	const dist = (a: number) => Math.min(Math.abs(a - hue), 360 - Math.abs(a - hue));
	return Object.values(ACCENTS).reduce((best, a) => (dist(a.hue) < dist(best.hue) ? a : best)).chart;
}

function isOption(value: unknown, options: object): value is string {
	return typeof value === "string" && Object.hasOwn(options, value);
}

const MAX_PINS = 50;

function sanitizePins(raw: unknown): number[] {
	if (!Array.isArray(raw)) return [];
	return [...new Set(raw.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, MAX_PINS);
}

/** Adds the id at the end, or removes it when already pinned. */
export function togglePinned(pins: number[], id: number): number[] {
	return pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id].slice(-MAX_PINS);
}

/** Stored data is untrusted (older versions, manual edits): keep only known keys with known values. */
export function sanitizePreferences(raw: unknown): Preferences {
	const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
	const dashboard = input.dashboard && typeof input.dashboard === "object" ? (input.dashboard as Record<string, unknown>) : {};
	const choices = Object.fromEntries(
		(Object.keys(CHOICES) as ChoiceKey[]).map((key) => [
			key,
			isOption(input[key], CHOICES[key]) ? input[key] : DEFAULT_PREFERENCES[key],
		]),
	);
	return {
		...DEFAULT_PREFERENCES,
		...choices,
		pinnedCourses: sanitizePins(input.pinnedCourses),
		hue: sanitizeHue(input.hue),
		accent: isOption(input.accent, ACCENTS) ? (input.accent as Accent) : DEFAULT_PREFERENCES.accent,
		dashboard: Object.fromEntries(
			(Object.keys(DASHBOARD_SECTIONS) as DashboardSection[]).map((key) => [
				key,
				typeof dashboard[key] === "boolean" ? dashboard[key] : DEFAULT_PREFERENCES.dashboard[key],
			]),
		) as Record<DashboardSection, boolean>,
	};
}

export function loadPreferences(): Preferences {
	try {
		return sanitizePreferences(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}"));
	} catch {
		return DEFAULT_PREFERENCES;
	}
}

export function savePreferences(prefs: Preferences): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// storage full or blocked: preferences still apply for this session
	}
}

/** Self-contained (no outer references) so it can be serialized into PREFERENCES_SCRIPT. */
function applyAppearanceWith(
	prefs: Record<string, string | number | null>,
	hues: Record<string, number>,
	keys: readonly string[],
	seasons: Record<string, { hue: number; sat: number }>,
	current: string | null,
) {
	const root = document.documentElement;
	const name = prefs.season === "auto" ? current : prefs.season === "none" ? null : (prefs.season as string);
	const season = name ? seasons[name] : undefined;
	root.style.setProperty("--hue", String(prefs.hue ?? season?.hue ?? hues[prefs.accent as string] ?? 264));
	// bleh's seasonal saturation is relative to its own base; ~1.5 is neutral here.
	root.style.setProperty("--season-sat", String(season ? season.sat / 1.5 : 1));
	if (name && season) root.dataset.season = name;
	else delete root.dataset.season;
	for (const key of keys) root.dataset[key] = String(prefs[key]);
}

export function applyAppearance(prefs: Preferences): void {
	applyAppearanceWith(
		prefs as unknown as Record<string, string | number | null>,
		HUES,
		APPEARANCE_KEYS,
		SEASONS,
		seasonForDate(new Date()),
	);
}

/** Runs in <head> before first paint so a custom accent/radius/font never flashes the defaults. */
export const PREFERENCES_SCRIPT = `try{(${applyAppearanceWith.toString()})(Object.assign(${JSON.stringify(
	DEFAULT_PREFERENCES,
)},JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}")),${JSON.stringify(HUES)},${JSON.stringify(
	APPEARANCE_KEYS,
)},${JSON.stringify(SEASONS)},(${seasonForDate.toString()})(new Date()))}catch(e){}`;

/** `undefined` lets Intl pick the locale default. */
export function hour12Of(clock: Preferences["clock"]): boolean | undefined {
	return clock === "auto" ? undefined : clock === "12h";
}
