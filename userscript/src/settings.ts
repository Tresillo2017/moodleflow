// Settings mirror bleh's own store (build/config.ts) for every setting that means something on Moodle, under the same
// key names, so its stylesheets work unchanged: bubble settings become data-bleh--* attributes on <body>, sliders become
// css variables (see apply.ts). Last.fm-only settings (scrobbles, charts, corrections, …) are deliberately absent.
export type Theme = { id: string; name: string; type: "light" | "dark" };

export const THEMES: Theme[] = [
	{ id: "light", name: "Light", type: "light" },
	{ id: "ink", name: "Ink", type: "light" },
	{ id: "rose_pine_dawn", name: "Rosé Pine Dawn", type: "light" },
	{ id: "nier", name: "NieR", type: "light" },
	{ id: "dark", name: "Dark", type: "dark" },
	{ id: "darker", name: "Darker", type: "dark" },
	{ id: "oled", name: "Void", type: "dark" },
	{ id: "rose_pine", name: "Rosé Pine", type: "dark" },
	{ id: "kanagawa_dragon", name: "Kanagawa", type: "dark" },
];

export type Settings = {
	// themes
	theme: string;
	theme_type: "light" | "dark";
	theme_schedule: boolean; // bleh's "adapt to my device": day theme in light mode, night theme in dark mode
	theme_day: string;
	theme_night: string;
	// colours
	hue: number; // 0–360
	sat: number; // 0–4
	sat_bg: number; // card background vibrancy, 0–5
	lit: number; // 0–1.5
	hue_from_course: boolean; // accent follows the course image (bleh: "change my colour when viewing albums")
	hue_from_profile: boolean;
	// materials
	solarium: boolean;
	noise: number;
	gloss: number;
	grid_glow: boolean;
	// text
	font_choice: "font_2026" | "font_2025" | "hyperlegible" | "custom";
	font: string;
	font_serif: boolean;
	font_weight: number;
	font_weight_medium: number;
	font_weight_bold: number;
	font_emoji: boolean;
	// artwork
	avatar_radius: "circle" | "squircle" | "square";
	show_disc_image: boolean;
	static_gifs: "always" | "hover" | "never";
	rain: boolean;
	// accessibility
	reduced_motion: boolean;
	reduced_flashing: boolean;
	show_scroller: boolean;
	underline_links: boolean;
	// seasonal
	seasonal: boolean;
	seasonal_particles: "all" | "less" | "none";
	seasonal_particles_fps: boolean;
	seasonal_overlays: boolean;
	seasonal_masks: boolean;
	// interface
	rabbit: boolean; // quick switcher (Ctrl/⌘ + K)
	branding_type: "logo" | "text";
	banner: boolean;
	bannerUrl: string;
	wide: boolean;
	course_nav: boolean; // sections list in the sidebar instead of the theme's tile carousel
	file_preview: boolean; // open pdfs, images, video, audio and text in a dialog instead of leaving the page
	shortcuts: boolean; // [ ] sections, / switcher, g-then-letter to go places, j k activities, ? cheat sheet
	update_check: boolean; // look for a newer moodleflow now and then
	home: boolean; // the redesigned dashboard (greeting, courses grid, week) instead of Moodle's blocks
	deadlines: boolean; // "Due soon" card on the dashboard
	resume: boolean; // "Continue" card on the dashboard + scroll position restore
	unread: boolean; // "new" markers on activities and course cards
	activity_popup: boolean; // open activities in a popout instead of a new page
	confetti: boolean; // celebrate a submitted assignment
	file_icons: boolean; // coloured PDF / PPT / SQL … badges on file activities
	course_tools: boolean; // pin / hide / rename buttons on course cards
};

export const DEFAULTS: Settings = {
	theme: "darker", theme_type: "dark", theme_schedule: false, theme_day: "light", theme_night: "darker",
	hue: 298, sat: 1.28, sat_bg: 1, lit: 0.9, hue_from_course: true, hue_from_profile: true,
	solarium: true, noise: 0.25, gloss: 0, grid_glow: true,
	font_choice: "font_2026", font: "", font_serif: true, font_weight: 400, font_weight_medium: 500, font_weight_bold: 600, font_emoji: true,
	avatar_radius: "circle", show_disc_image: true, static_gifs: "always", rain: false,
	reduced_motion: false, reduced_flashing: false, show_scroller: false, underline_links: false,
	seasonal: false, seasonal_particles: "all", seasonal_particles_fps: false, seasonal_overlays: true, seasonal_masks: true,
	rabbit: true, branding_type: "logo", banner: true, bannerUrl: "", wide: false,
	course_nav: true, file_preview: true, shortcuts: true, update_check: true,
	home: true, deadlines: true, resume: true, unread: true, course_tools: true, file_icons: true, activity_popup: true, confetti: true,
};

const KEY = "settings";
type Listener = (s: Settings, changed: (keyof Settings)[]) => void;
const listeners = new Set<Listener>();
let current: Settings = { ...DEFAULTS };

export const get = (): Settings => current;
export const isDefault = (k: keyof Settings): boolean => current[k] === DEFAULTS[k];

const RANGES: Partial<Record<keyof Settings, [number, number]>> = {
	hue: [0, 360], sat: [0, 4], sat_bg: [0, 5], lit: [0, 1.5], noise: [0, 1], gloss: [0, 1],
	font_weight: [100, 600], font_weight_medium: [400, 750], font_weight_bold: [500, 900],
};
const themeIds = THEMES.map((t) => t.id);
const ENUMS: Partial<Record<keyof Settings, string[]>> = {
	theme: themeIds, theme_day: themeIds, theme_night: themeIds, theme_type: ["light", "dark"],
	font_choice: ["font_2026", "font_2025", "hyperlegible", "custom"], avatar_radius: ["circle", "squircle", "square"],
	static_gifs: ["always", "hover", "never"], seasonal_particles: ["all", "less", "none"], branding_type: ["logo", "text"],
};
const MAX_TEXT = 200;

/** Keeps only known keys whose value has the right type (numbers finite and clamped, enums known, text bounded). */
export function sanitize(input: unknown): Partial<Settings> {
	const out: Record<string, unknown> = {};
	if (!input || typeof input !== "object" || Array.isArray(input)) return out;
	for (const [k, v] of Object.entries(input)) {
		if (!Object.hasOwn(DEFAULTS, k) || typeof v !== typeof DEFAULTS[k as keyof Settings]) continue;
		const key = k as keyof Settings;
		if (typeof v === "number") {
			if (!Number.isFinite(v)) continue;
			const r = RANGES[key];
			out[k] = r ? Math.min(r[1], Math.max(r[0], v)) : v;
		} else if (typeof v === "string") {
			const e = ENUMS[key];
			if (e && !e.includes(v)) continue;
			out[k] = v.slice(0, MAX_TEXT);
		} else out[k] = v;
	}
	return out as Partial<Settings>;
}

export function load(): Settings {
	try {
		const raw = JSON.parse(GM_getValue(KEY, "{}"));
		if (raw && raw.match_system === true && raw.theme_schedule === undefined) raw.theme_schedule = true; // 0.4 → 0.5
		current = { ...DEFAULTS, ...sanitize(raw) };
	} catch { current = { ...DEFAULTS }; }
	return current;
}

export function set(patch: Partial<Settings>): void {
	const changed = (Object.keys(patch) as (keyof Settings)[]).filter((k) => patch[k] !== current[k]);
	if (!changed.length) return;
	current = { ...current, ...patch };
	GM_setValue(KEY, JSON.stringify(current));
	listeners.forEach((fn) => fn(current, changed));
}

export const reset = (k?: keyof Settings): void => set(k ? { [k]: DEFAULTS[k] } : { ...DEFAULTS });
export const subscribe = (fn: Listener): void => { listeners.add(fn); };
