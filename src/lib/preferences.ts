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
	violet: { label: "Violet", hue: 298, ditherHue: 268, chart: "purple" },
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
	darkTheme: { dark: "Dark", darker: "Darker", oled: "OLED", rose_pine: "Rosé Pine", kanagawa_dragon: "Kanagawa Dragon" },
	lightTheme: { light: "Light", ink: "Ink", rose_pine_dawn: "Rosé Pine Dawn" },
	radius: { none: "None", sm: "Small", md: "Medium", lg: "Large" },
	font: { bleh: "Hanken Grotesk", system: "System", serif: "Serif", mono: "Mono" },
	season: {
		none: "Off",
		auto: "Automatic",
		new_years: "New Year",
		easter: "Easter",
		pride: "Pride",
		summer: "Summer",
		halloween: "Halloween",
		pre_fall: "Early fall",
		fall: "Fall",
		christmas: "Christmas",
	},
	overlays: { on: "On", off: "Off" },
	particles: { none: "None", less: "Less", normal: "Normal" },
	glass: { on: "On", off: "Off" },
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
	season: "none",
	overlays: "on",
	particles: "normal",
	glass: "on",
	vibrance: "normal",
	weight: "normal",
	darkTheme: "dark",
	lightTheme: "light",
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

const APPEARANCE_KEYS = ["radius", "font", "scale", "motion", "vibrance", "weight"] as const;

const HUES = Object.fromEntries(Object.entries(ACCENTS).map(([key, a]) => [key, a.hue]));

function sanitizeHue(raw: unknown): number | null {
	return typeof raw === "number" && Number.isFinite(raw) ? ((Math.round(raw) % 360) + 360) % 360 : null;
}

/**
 * Seasons and their date windows, from bleh (fm/src/build/seasonal.js, GPL-3.0). `snow` is how many
 * flakes fall (0 for none). `hue` mirrors --hue-seasonal in styles/bleh/theme.css, for JS-side consumers.
 */
export const SEASONS = {
	new_years: { hue: 324, start: [1, 1], end: [1, 14], snow: 90 },
	easter: { hue: 114, start: [4, 2], end: [4, 30], snow: 0 },
	pride: { hue: 276, start: [6, 1], end: [6, 30], snow: 0 },
	summer: { hue: 43, start: [7, 1], end: [9, 10], snow: 0 },
	halloween: { hue: 35, start: [9, 28], end: [11, 1], snow: 0 },
	pre_fall: { hue: 43, start: [11, 1.5], end: [11, 12], snow: 12 },
	fall: { hue: 256, start: [11, 13], end: [11, 22], snow: 80 },
	christmas: { hue: 19, start: [11, 23], end: [12, 31], snow: 160 },
} as const;

export type SeasonName = keyof typeof SEASONS;

/** Self-contained (serialized into PREFERENCES_SCRIPT). Day `d.5` means noon, as bleh's pre_fall starts at 12:00. */
export function seasonForDate(d: Date, seasons: Record<string, { start: readonly number[]; end: readonly number[] }> = SEASONS): string | null {
	const at = (month: number, day: number, end: boolean) => {
		const whole = Math.floor(day);
		return new Date(d.getFullYear(), month - 1, whole, end ? 23 : day > whole ? 12 : 0, end ? 59 : 0, end ? 59 : 0);
	};
	return Object.keys(seasons).find((id) => d >= at(seasons[id].start[0], seasons[id].start[1], false) && d <= at(seasons[id].end[0], seasons[id].end[1], true)) ?? null;
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

/**
 * Self-contained (no outer references) so it can be serialized into PREFERENCES_SCRIPT.
 * Sets the same html attributes and variables bleh sets on <body> (data-bleh--theme, --season, --solarium...),
 * which styles/bleh/theme.css keys off.
 */
function applyAppearanceWith(
	prefs: Record<string, string | number | null>,
	hues: Record<string, number>,
	keys: readonly string[],
	current: string | null,
) {
	const root = document.documentElement;
	const set = (key: string, value: string | null) =>
		value === null ? root.removeAttribute("data-bleh--" + key) : root.setAttribute("data-bleh--" + key, value);

	let stored: string | null = null;
	try {
		stored = localStorage.getItem("theme");
	} catch {
		// storage blocked: follow the system
	}
	const dark = root.classList.contains("dark") || stored === "dark" || (stored !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
	set("theme", String(dark ? prefs.darkTheme : prefs.lightTheme));
	set("theme_type", dark ? "dark" : "light");
	set("solarium", String(prefs.glass === "on"));
	set("seasonal_overlays", String(prefs.overlays === "on"));
	set("reduced_motion", String(prefs.motion === "reduced"));

	const name = prefs.season === "auto" ? current : prefs.season === "none" ? null : (prefs.season as string);
	set("season", name);
	const style = root.style;
	if (prefs.hue !== null) style.setProperty("--hue-over", String(prefs.hue));
	else style.removeProperty("--hue-over");
	// A season supplies the hue itself; otherwise the accent preset is the "user" hue.
	if (!name && prefs.hue === null) style.setProperty("--hue-user", String(hues[prefs.accent as string] ?? 298));
	else style.removeProperty("--hue-user");
	const sat = { muted: "0.5", vivid: "2.6" }[prefs.vibrance as string];
	if (sat) style.setProperty("--sat-over", sat);
	else style.removeProperty("--sat-over");
	const weight = { light: 340, normal: 400, medium: 500 }[prefs.weight as string] ?? 400;
	style.setProperty("--custom_font_weight", String(weight));
	style.setProperty("--custom_font_weight_medium", String(weight + 100));

	for (const key of keys) root.dataset[key] = String(prefs[key]);
}

export function applyAppearance(prefs: Preferences): void {
	applyAppearanceWith(
		prefs as unknown as Record<string, string | number | null>,
		HUES,
		APPEARANCE_KEYS,
		seasonForDate(new Date()),
	);
}

/** Runs in <head> before first paint so a custom accent/radius/font never flashes the defaults. */
// The bundler can inject a __name() helper into serialized functions; define it so the script never throws.
export const PREFERENCES_SCRIPT = `try{var __name=function(f){return f};(${applyAppearanceWith.toString()})(Object.assign(${JSON.stringify(
	DEFAULT_PREFERENCES,
)},JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}")),${JSON.stringify(HUES)},${JSON.stringify(
	APPEARANCE_KEYS,
)},(${seasonForDate.toString()})(new Date(),${JSON.stringify(SEASONS)}))}catch(e){}`;

/** `undefined` lets Intl pick the locale default. */
export function hour12Of(clock: Preferences["clock"]): boolean | undefined {
	return clock === "auto" ? undefined : clock === "12h";
}
