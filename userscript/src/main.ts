import bleh from "../dist/core.css";
import moodle from "./styles/moodle.css";
import classroom from "./styles/classroom.css";
import { apply, onSystemThemeChange } from "./apply";
import { buildShell, setHeaderAvatar, installSettingsRoute, NO_SHELL_LAYOUTS } from "./shell";
import { mountBackdrop, refreshBackdrop, earlyAccent } from "./backdrop";
import { mountIcons, mountDecorate } from "./icons";
import { mountSeasonal } from "./seasonal";
import { mountEffects } from "./effects";
import { mountRabbit } from "./rabbit";
import { mountFix } from "./fix";
import { mountCourseNav } from "./coursenav";
import { mountPreview } from "./preview";
import { mountUpdater } from "./updater";
import { mountDeadlines } from "./deadlines";
import { mountResume } from "./resume";
import { mountUnread } from "./unread";
import { mountCourseTools } from "./courses";
import { mountKeys } from "./keys";
import { applyLazy } from "./lazy";
import { loadFonts } from "./fonts";
import * as settings from "./settings";

const mark = (n: string) => performance.mark(`mf:${n}`);
/** Time a synchronous step: shows up as a `mf:<name>` measure (see perf notes in README). */
const timed = <T>(name: string, fn: () => T): T => { const t0 = performance.now(); const r = fn(); performance.measure(`mf:${name}`, { start: t0, end: performance.now() }); return r; };
mark("script");
// debug: localStorage["mf:off"] = "shell,fix,backdrop,…" skips those modules (used to bisect performance problems)
const OFF = new Set((localStorage.getItem("mf:off") ?? "").split(",").filter(Boolean));
const on = (m: string) => !OFF.has(m);
let active = false; // false on layouts we leave alone

/** Until the shell is built the page shows Moodle's own layout, which then jumps into bleh's. Keep it hidden (on a
 *  dark/light backdrop that matches the theme, so there is no white flash) and always give up after 2.5s. */
let revealed = false;
function hideUntilReady(): void {
	const dark = settings.get().theme_type === "dark" || settings.get().theme_schedule;
	document.documentElement.style.background = dark ? "#151517" : "#f6f6f8";
	document.documentElement.classList.add("mf-pending");
	setTimeout(reveal, 2500);
}
function reveal(): void {
	if (revealed) return;
	revealed = true;
	document.documentElement.classList.remove("mf-pending");
	document.documentElement.style.background = "";
}

// document-start can run before <html> or <body> exist; poll the tree until the node we need shows up
function when(ready: () => unknown, fn: () => void): void {
	if (ready()) return fn();
	new MutationObserver((_, o) => { if (ready()) { o.disconnect(); fn(); } }).observe(document, { childList: true, subtree: true });
}

// The <body> element (and its class list) exists before any content paints, so we can decide per page type up front:
// embedded/popup/print/secure layouts are left completely untouched.
when(() => document.body, () => {
	if (NO_SHELL_LAYOUTS.test(document.body.className)) return;
	settings.load();
	const style = timed("inject-css", () => GM_addStyle(bleh + moodle + classroom));
	// Moodle's stylesheets load after ours and win equal-specificity ties against bleh's rules, so keep ours last
	const keepLast = () => { if (style.parentNode && style.nextElementSibling) style.parentNode.append(style); };
	const obs = new MutationObserver(keepLast);
	obs.observe(document.documentElement, { childList: true, subtree: true });
	addEventListener("load", () => { keepLast(); obs.disconnect(); }, { once: true }); // stylesheets are all in by `load`
	mark("css");
	if (on("hide")) hideUntilReady();
	timed("apply", () => { if (on("apply")) apply(settings.get()); if (on("lazy")) applyLazy(); if (on("fonts")) loadFonts(); if (on("backdrop")) earlyAccent(); }); // before first paint of content: no flash of the light theme
	active = true;
});
settings.subscribe((st) => { if (!active) return; apply(st); applyLazy(); loadFonts(); });
onSystemThemeChange(() => active && apply(settings.get()));

// the shell needs Moodle's finished DOM
function start(): void {
	if (!active) { reveal(); return; }
	timed("icons", () => { if (on("icons")) { mountIcons(); mountDecorate(); } });
	if (on("shell")) timed("shell", buildShell);
	mark("shell");
	timed("settings-route", installSettingsRoute);
	timed("extras", () => { if (on("extras")) { mountSeasonal(); mountEffects(); mountRabbit(); mountCourseNav(); mountPreview(); mountUpdater(); mountDeadlines(); mountResume(); mountUnread(); mountCourseTools(); mountKeys(); } });
	if (on("fix")) timed("fix", mountFix);
	reveal();
	mark("mounted");
	if (on("backdrop")) { timed("backdrop", mountBackdrop); void refreshBackdrop(setHeaderAvatar); }
	settings.subscribe((_, changed) => { if (changed.some((k) => ["banner", "bannerUrl", "show_disc_image", "hue_from_course", "hue_from_profile"].includes(k))) void refreshBackdrop(setHeaderAvatar); });
}
// the whole body is parsed at `interactive`, which comes before DOMContentLoaded (that waits for Moodle's deferred scripts)
let started = false;
const go = () => { if (started || document.readyState === "loading") return; started = true; start(); };
document.readyState === "loading" ? document.addEventListener("readystatechange", go) : go();

GM_registerMenuCommand("moodleflow settings", () => { location.hash = "#moodleflow/visual"; });

// For adapting a site whose theme differs from stock Moodle: copies tags/ids/classes only (no text, no values).
function copyStructure(): void {
	const lines: string[] = [`${location.origin}${location.pathname}  body#${document.body.id} .${document.body.className}`];
	const walk = (el: Element, d: number) => {
		if (d > 8 || /^(SCRIPT|STYLE|SVG|PATH|NOSCRIPT)$/i.test(el.tagName)) return;
		const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 6).join(".") : "";
		const data = ["data-region", "data-key", "role"].map((a) => (el.getAttribute(a) ? `[${a}=${el.getAttribute(a)}]` : "")).join("");
		lines.push("  ".repeat(d) + el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + cls + data);
		for (const c of el.children) walk(c, d + 1);
	};
	walk(document.body, 0);
	void navigator.clipboard.writeText(lines.join("\n")).then(() => alert(`Copied ${lines.length} lines`), () => alert("Clipboard blocked; open the console instead"));
}
GM_registerMenuCommand("moodleflow: copy page structure", copyStructure);
document.addEventListener("moodleflow:copy-structure", copyStructure);
