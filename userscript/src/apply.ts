// Writes settings onto <body> exactly the way bleh does (config.ts): attributes for bubble settings, css custom
// properties for sliders. Everything visual then comes from bleh's own css.
import { Settings, THEMES, DEFAULTS } from "./settings";

const mq = matchMedia("(prefers-color-scheme: dark)");
const reduceMq = matchMedia("(prefers-reduced-motion: reduce)");

/** The theme actually in effect: with "adapt to my device" on, the day/night pair follows the OS setting. */
export function effectiveTheme(s: Settings): string {
	return s.theme_schedule ? (mq.matches ? s.theme_night : s.theme_day) : s.theme;
}

export function apply(s: Settings): void {
	const body = document.body;
	if (!body) return;
	const theme = effectiveTheme(s);
	const type = THEMES.find((x) => x.id === theme)?.type ?? "dark";
	const attrs: Record<string, string> = {
		theme, theme_type: type,
		solarium: String(s.solarium), reduced_motion: String(s.reduced_motion || reduceMq.matches), reduced_flashing: String(s.reduced_flashing),
		underline_links: String(s.underline_links), show_scroller: String(s.show_scroller),
		font_choice: s.font_choice, font_serif: String(s.font_serif), font_emoji: String(s.font_emoji), grid_glow: String(s.grid_glow),
		avatar_radius: s.avatar_radius, seasonal_particles_fps: String(s.seasonal_particles_fps),
		seasonal_overlays: String(s.seasonal_overlays), seasonal_masks: String(s.seasonal_masks),
	};
	for (const [k, v] of Object.entries(attrs)) body.setAttribute(`data-bleh--${k}`, v);
	body.dataset.mfWide = String(s.wide);
	body.dataset.mfBanner = String(s.banner);

	const style = body.style;
	// bleh only sets the user's hue/sat/lit when they differ from the defaults, so themes keep their own tuned values
	const user: [string, keyof Settings][] = [["hue-user", "hue"], ["sat-user", "sat"], ["lit-user", "lit"]];
	for (const [css, key] of user) {
		if (s[key] === DEFAULTS[key]) style.removeProperty(`--${css}`);
		else style.setProperty(`--${css}`, String(s[key]));
	}
	const vars: [string, string | number][] = [
		["sat-bg", s.sat_bg], ["noise-opacity", s.noise], ["gloss", s.gloss],
		["custom_font_weight", s.font_weight], ["custom_font_weight_medium", s.font_weight_medium], ["custom_font_weight_bold", s.font_weight_bold],
	];
	for (const [css, v] of vars) style.setProperty(`--${css}`, String(v));
	if (s.font_choice === "custom" && s.font.trim()) style.setProperty("--custom_font", s.font.replace(/[;{}<>]/g, ""));
	else style.removeProperty("--custom_font");
	document.documentElement.style.colorScheme = type;
}

export const onSystemThemeChange = (fn: () => void): void => { mq.addEventListener("change", fn); reduceMq.addEventListener("change", fn); };
