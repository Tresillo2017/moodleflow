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
	font: { geist: "Geist", system: "System", serif: "Serif", mono: "Mono" },
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
	dashboard: Record<DashboardSection, boolean>;
};

export const DEFAULT_PREFERENCES: Preferences = {
	accent: "indigo",
	darkStyle: "black",
	radius: "md",
	font: "geist",
	scale: "md",
	motion: "system",
	sidebar: "sidebar",
	width: "normal",
	weekStart: "monday",
	clock: "auto",
	dashboard: { stats: true, upcoming: true, courses: true, activity: true, calendar: true },
};

const APPEARANCE_KEYS = ["darkStyle", "radius", "font", "scale", "motion"] as const;

const HUES = Object.fromEntries(Object.entries(ACCENTS).map(([key, a]) => [key, a.hue]));

function isOption(value: unknown, options: object): value is string {
	return typeof value === "string" && Object.hasOwn(options, value);
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
function applyAppearanceWith(prefs: Record<string, string>, hues: Record<string, number>, keys: readonly string[]) {
	const root = document.documentElement;
	root.style.setProperty("--hue", String(hues[prefs.accent] ?? 264));
	for (const key of keys) root.dataset[key] = prefs[key];
}

export function applyAppearance(prefs: Preferences): void {
	applyAppearanceWith(prefs as unknown as Record<string, string>, HUES, APPEARANCE_KEYS);
}

/** Runs in <head> before first paint so a custom accent/radius/font never flashes the defaults. */
export const PREFERENCES_SCRIPT = `try{(${applyAppearanceWith.toString()})(Object.assign(${JSON.stringify(
	DEFAULT_PREFERENCES,
)},JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}")),${JSON.stringify(HUES)},${JSON.stringify(
	APPEARANCE_KEYS,
)})}catch(e){}`;

/** `undefined` lets Intl pick the locale default. */
export function hour12Of(clock: Preferences["clock"]): boolean | undefined {
	return clock === "auto" ? undefined : clock === "12h";
}
