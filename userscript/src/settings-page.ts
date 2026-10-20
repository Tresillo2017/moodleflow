// bleh's settings pages (pages/bleh_settings/*, components/settings/*) rebuilt with plain DOM and bleh's own class names.
// Every Moodle-relevant bleh setting has a row here. All tabs are built once; the toolbar switches between them and the
// sidebar search filters rows across all of them, like bleh's.
import * as s from "./settings";
import { DEFAULTS, Settings, THEMES } from "./settings";
import { h, Kid } from "./dom";
import { SEASONS, seasonState, rangeLabel } from "./seasonal";
import { checkForUpdate, current, INSTALL_URL } from "./updater";

type Cond = (st: Settings) => boolean;
const updaters: ((st: Settings) => void)[] = [];

const bleh = (name: string): HTMLElement =>
	h("span", { class: `bleh-icon bleh-icon-${name} use-mask`, style: `--icon: var(--icon-16-${name})` }, `${name} (icon)`);
const panelHead = (icon: string, title: string) => h("h4", { class: "header-with-icon with-margin" }, bleh(icon), title);
const panel = (head: HTMLElement, ...kids: Kid[]) => h("section", { class: "bleh--panel" }, head, ...kids);
const group = (...kids: Kid[]) => h("div", { class: "setting-group" }, ...kids);

/** Marks a row with its searchable text and wires `disabled` / `hidden` conditions (bleh's incompatible / hide_if). */
function row(el: HTMLElement, name: string, body = "", opts: { disabled?: Cond; hidden?: Cond } = {}): HTMLElement {
	el.setAttribute("data-search", `${name} ${body}`.toLowerCase());
	if (opts.disabled || opts.hidden) {
		updaters.push((st) => {
			if (opts.disabled) el.toggleAttribute("disabled", opts.disabled(st));
			if (opts.hidden) el.hidden = opts.hidden(st);
		});
	}
	return el;
}

function label(name: string, body?: string, reset?: HTMLElement): HTMLElement {
	return h("div", { class: "heading setting-inner" }, h("h5", { class: "setting-name" }, name, reset), body ? h("p", { class: "setting-body" }, body) : null);
}
const icon = (name?: string) => (name ? h("div", { class: "setting-icon" }, bleh(name)) : null);

function resetButton(key: keyof Settings): HTMLButtonElement {
	const b = h("button", { type: "button", class: "btn flex-button chibi reset", "data-modified": "false" }, bleh("reset"), "Reset");
	b.onclick = (e) => { e.stopPropagation(); s.reset(key); };
	updaters.push((st) => b.setAttribute("data-modified", String(st[key] !== DEFAULTS[key])));
	return b;
}

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
type NumKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];
type StrKey = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];
type Opts = { icon?: string; disabled?: Cond; hidden?: Cond };

function switchRow(key: BoolKey, name: string, body: string, o: Opts = {}): HTMLElement {
	const input = h("input", { type: "checkbox", name: key });
	const lab = h("label", { class: "switch-label" });
	const btn = h("button", { type: "button", class: "btn toggle colourful", "aria-checked": "false" }, h("div", { class: "dot" }), lab);
	const el = h("div", { class: "setting", "data-type": "toggle", id: `setting_${key}` }, icon(o.icon), label(name, body), h("div", { class: "toggle-wrap setting-inner" }, input, btn));
	el.onclick = () => { if (!el.hasAttribute("disabled")) s.set({ [key]: !s.get()[key] } as Partial<Settings>); };
	updaters.push((st) => { input.checked = st[key]; btn.setAttribute("aria-checked", String(st[key])); lab.textContent = st[key] ? "On" : "Off"; });
	return row(el, name, body, o);
}

function checkboxRow(key: BoolKey, name: string, body = "", o: Opts = {}): HTMLElement {
	const input = h("input", { type: "checkbox", name: key });
	const btn = h("button", { type: "button", class: "btn check-box", "aria-checked": "false" }, h("div", { class: "bleh-icon" }));
	const el = h("div", { class: "setting standalone", "data-type": "checkbox", id: `setting_${key}` }, icon(o.icon), h("div", { class: "checkbox-wrap setting-inner" }, input, btn), label(name, body));
	el.onclick = () => { if (!el.hasAttribute("disabled")) s.set({ [key]: !s.get()[key] } as Partial<Settings>); };
	updaters.push((st) => { input.checked = st[key]; btn.setAttribute("aria-checked", String(st[key])); });
	return row(el, name, body, o);
}

function rangeRow(key: NumKey, name: string, body: string, min: number, max: number, step: number, o: Opts = {}): HTMLElement {
	const input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), "aria-label": name });
	const track = h("div", { class: "track colourful", "data-id": key }, h("div", { class: "fill" }), h("div", { class: "nub" }));
	const marker = h("p", { class: "value-marker" });
	const el = h("div", { class: "setting", "data-type": "input", id: `setting_${key}` }, icon(o.icon), label(name, body, resetButton(key)), h("div", { class: "range setting-inner" }, track, marker, input));
	input.oninput = () => s.set({ [key]: +input.value } as Partial<Settings>);
	updaters.push((st) => {
		const v = st[key];
		input.value = String(v);
		marker.textContent = String(v);
		track.style.setProperty("--percent", `${((v - min) / (max - min)) * 100}%`);
	});
	return row(el, name, body, o);
}

function radioRow<K extends StrKey>(key: K, name: string, body: string, options: [Settings[K], string][], o: Opts = {}): HTMLElement {
	const items = options.map(([value, text]) => {
		const input = h("input", { type: "radio", name: key, value: String(value) });
		const btn = h("button", { type: "button", class: "btn radio", "aria-checked": "false" });
		const item = h("div", { class: "setting standalone", "data-type": "radio" }, h("div", { class: "radio-cont setting-inner" }, input, btn), h("div", { class: "heading setting-inner" }, h("h5", { class: "setting-name" }, text)));
		item.onclick = (e) => { e.stopPropagation(); if (!el.hasAttribute("disabled")) s.set({ [key]: value } as Partial<Settings>); };
		updaters.push((st) => { const on = st[key] === value; input.checked = on; btn.setAttribute("aria-checked", String(on)); });
		return item;
	});
	const el = h("div", { class: "setting", "data-type": "radio", id: `setting_${key}` }, icon(o.icon), label(name, body, resetButton(key)), h("div", { class: "primary-selections" }, ...items));
	return row(el, `${name} ${options.map((x) => x[1]).join(" ")}`, body, o);
}

function selectRow(key: StrKey, name: string, body: string, options: [string, string][], o: Opts = {}): HTMLElement {
	const sel = h("select", { "aria-label": name }, ...options.map(([v, t]) => h("option", { value: v }, t)));
	sel.onchange = () => s.set({ [key]: sel.value } as Partial<Settings>);
	const el = h("div", { class: "setting", "data-type": "select", id: `setting_${key}` }, icon(o.icon), label(name, body), h("div", { class: "setting-inner" }, sel));
	updaters.push((st) => { sel.value = String(st[key]); });
	return row(el, name, body, o);
}

function textRow(key: StrKey, name: string, body: string, placeholder: string, o: Opts = {}): HTMLElement {
	const input = h("input", { type: key === "bannerUrl" ? "url" : "text", class: "input", placeholder, maxlength: "200", "aria-label": name });
	input.onchange = () => s.set({ [key]: input.value.trim() } as Partial<Settings>);
	const el = h("div", { class: "setting", "data-type": "input", id: `setting_${key}` }, icon(o.icon), label(name, body, resetButton(key)), h("div", { class: "setting-inner" }, input));
	updaters.push((st) => { if (document.activeElement !== input) input.value = st[key]; });
	return row(el, name, body, o);
}

function actionRow(name: string, body: string, buttonText: string, fn: () => void, o: Opts = {}): HTMLElement {
	const b = h("button", { type: "button", class: "btn flex-button" }, buttonText);
	b.onclick = fn;
	return row(h("div", { class: "setting", "data-type": "action" }, icon(o.icon), label(name, body), h("div", { class: "setting-inner" }, b)), name, body, o);
}

function updateRow(): HTMLElement {
	const b = h("button", { type: "button", class: "btn flex-button" }, "Check now");
	const body = h("p", { class: "setting-body" }, `You have v${current()}`);
	let latest = "";
	b.onclick = async () => {
		if (latest) { window.open(INSTALL_URL, "_blank", "noopener"); return; }
		b.textContent = "Checking…";
		const r = await checkForUpdate(true);
		if (r.error) { body.textContent = `Couldn't check (${r.error})`; b.textContent = "Try again"; }
		else if (r.newer) { latest = r.latest!; body.textContent = `v${latest} is available (you have v${current()})`; b.textContent = "Update"; }
		else { body.textContent = `You're up to date (v${current()})`; b.textContent = "Check now"; }
	};
	return row(h("div", { class: "setting", "data-type": "action" }, icon("external"), h("div", { class: "heading setting-inner" }, h("h5", { class: "setting-name" }, "Latest version"), body), h("div", { class: "setting-inner" }, b)), "updates version check update", "moodleflow");
}

// ---- themes ----
function themeBubble(id: string, name: string, type: "light" | "dark", pick: (id: string, type: "light" | "dark") => void, active: (st: Settings) => boolean): HTMLElement {
	const preview = h("div", { class: "bubble" }, h("div", { class: "inner theme-preview colourful", "data-bleh--theme": id, "data-bleh--theme_type": type },
		h("div", { class: "preview-inner" }, h("div", { class: "preview-image" }),
			h("div", { class: "preview-card" },
				h("div", { class: "preview-card-main" }, h("div", { class: "preview-header" }, "Aa"), h("div", { class: "preview-text" }), h("div", { class: "preview-text row-2" }), h("div", { class: "preview-text row-3" })),
				h("div", { class: "preview-card-side" })))));
	const b = h("button", { type: "button", class: "btn theme-bubble", "data-theme-id": id }, preview, h("strong", {}, h("span", { class: "theme-name" }, name)));
	b.onclick = (e) => { e.stopPropagation(); pick(id, type); };
	updaters.push((st) => b.setAttribute("aria-selected", String(active(st))));
	return b;
}

function themeRow(ic: string, name: string, body: string, type: "light" | "dark"): HTMLElement {
	const pick = (id: string, t: "light" | "dark") => s.set({ theme: id, theme_type: t });
	const el = h("div", { class: "setting theme-row" }, icon(ic), label(name, body),
		h("div", { class: "theme-bubbles" }, ...THEMES.filter((t) => t.type === type).map((t) => themeBubble(t.id, t.name, t.type, pick, (st) => st.theme === t.id))));
	return row(el, `${name} theme`, body, { disabled: (st) => st.theme_schedule });
}

/** day/night pickers for "adapt to my device" */
function scheduleRow(key: "theme_day" | "theme_night", name: string, body: string): HTMLElement {
	return selectRow(key, name, body, THEMES.map((t) => [t.id, t.name]), { hidden: (st) => !st.theme_schedule });
}

// ---- colours ----
const PRESETS: { name: string; hue: number; sat: number; lit: number }[] = [
	{ name: "Red", hue: 19, sat: 1.5, lit: 0.84 }, { name: "Orange", hue: 37, sat: 1.4, lit: 0.9 }, { name: "Yellow", hue: 73, sat: 1.38, lit: 1.07 },
	{ name: "Lime", hue: 115, sat: 1.16, lit: 1 }, { name: "Green", hue: 145, sat: 1.6, lit: 0.95 }, { name: "Aqua", hue: 178, sat: 1, lit: 1 },
	{ name: "Blue", hue: 248, sat: 1.45, lit: 0.82 }, { name: "Purple", hue: 290, sat: 1.45, lit: 0.82 }, { name: "Pink", hue: 340, sat: 1.35, lit: 0.93 },
	{ name: "Grey", hue: 0, sat: 0, lit: 1 },
];
function presetsRow(): HTMLElement {
	const swatches = [{ name: "Default", hue: DEFAULTS.hue, sat: DEFAULTS.sat, lit: DEFAULTS.lit }, ...PRESETS].map((p) => {
		const b = h("button", { type: "button", class: "swatch colourful", title: p.name, "aria-label": p.name, style: `--hue-over:${p.hue};--sat-over:${p.sat};--lit-over:${p.lit}` });
		b.onclick = () => s.set({ hue: p.hue, sat: p.sat, lit: p.lit });
		updaters.push((st) => b.setAttribute("aria-pressed", String(st.hue === p.hue && st.sat === p.sat && st.lit === p.lit)));
		return b;
	});
	return row(h("div", { class: "setting", "data-type": "action" }, label("Presets", "A few ready-made accents"), h("div", { class: "swatch-group palette" }, ...swatches)), "Presets colour accent", "ready-made accents");
}

function tiles(): HTMLElement {
	const t = (type: string, text: string) => h("div", { class: "colour-tile-wrap" }, h("div", { class: `colour-tile mini colourful ${type}` }), h("div", { class: "colour-tile-type" }, text));
	return h("div", { class: "inner-preview" }, h("div", { class: "colour-tiles" },
		t("b2", "Body 2"), t("b3", "Body 3"), t("b4", "Body 4"), t("b5", "Body 5"), t("l3", "Text 3"), t("l4", "Text 4"), t("h3", "Fill 3"), t("h4", "Fill 4")));
}

// ---- seasons ----
function seasonTimeline(): HTMLElement {
	const list = h("div", { class: "setting-group" });
	const rows = SEASONS.map((se) => {
		const r = h("div", { class: "setting", "data-type": "info" }, label(se.name, rangeLabel(se)), h("div", { class: "setting-inner season-state" }));
		list.append(r);
		return { se, state: r.querySelector(".season-state")! };
	});
	updaters.push(() => {
		const { current, next } = seasonState(new Date());
		for (const { se, state } of rows) state.textContent = current?.id === se.id ? "Now" : next.id === se.id && !current ? "Next up" : "";
	});
	return row(list, "seasons timeline new year easter pride summer halloween fall christmas", "");
}

// ---- tabs ----
export type Tab = { id: string; name: string; icon: string; build: () => HTMLElement[] };
export const TABS: Tab[] = [
	{ id: "general", name: "General", icon: "settings", build: () => [
		panel(panelHead("bleh", "Branding"), group(radioRow("branding_type", "Header branding", "What the masthead shows next to the navigation", [["logo", "Site logo"], ["text", "Site name"]]))),
		panel(panelHead("external", "Updates"), group(updateRow(), switchRow("update_check", "Check for updates", "Look for a newer moodleflow about twice a day and tell you when there is one"))),
		panel(panelHead("info", "About"), group(row(h("div", { class: "setting", "data-type": "info" }, label("moodleflow", `bleh for Moodle · v${typeof __VERSION__ === "string" ? __VERSION__ : ""}`)), "about moodleflow version", "bleh"),
			actionRow("bleh", "The Last.fm redesign this is ported from, by katelyn", "Open repository", () => { window.open("https://github.com/katelyynn/bleh", "_blank", "noopener"); }, { icon: "external" }))),
	] },
	{ id: "visual", name: "Visual", icon: "themes", build: () => [
		panel(panelHead("themes", "Themes"),
			group(themeRow("sun", "Bright", "Perfect for daylight", "light"), themeRow("moon", "Moody", "Get cosy under the moonlight", "dark"),
				switchRow("theme_schedule", "Adapt to my device", "Use a day theme when your device is light and a night theme when it is dark"),
				scheduleRow("theme_day", "Day theme", "Used when your device is in light mode"), scheduleRow("theme_night", "Night theme", "Used when your device is in dark mode")),
			group(switchRow("solarium", "Enable solarium glass effects", "Apply a see-through glassy material to many surfaces"),
				rangeRow("noise", "Noise overlay opacity", "Apply a coat of subtle noise to add variation to solid backgrounds", 0, 1, 0.05),
				rangeRow("sat_bg", "Card background vibrancy", "Bring some colour into your world (or reduce it)", 0, 5, 0.2),
				rangeRow("gloss", "Gloss", "Add a glassy shine to cover art", 0, 1, 0.05))),
		panel(panelHead("accent", "Colours"), tiles(),
			group(presetsRow(), rangeRow("hue", "Accent colour", "Pick a hue", 0, 360, 1), rangeRow("sat", "Vibrancy", "How vivid the accent is", 0, 4, 0.01), rangeRow("lit", "Lightness", "How light the accent is", 0, 1.5, 0.01)),
			group(row(h("div", { class: "setting", "data-type": "info" }, label("Change my colour when viewing…", "Let the page's artwork tint your accent")), "change my colour when viewing", "courses profiles artwork"),
				checkboxRow("hue_from_course", "Courses", "Use the course image's colour"), checkboxRow("hue_from_profile", "Profiles", "Use the profile photo's colour"))),
		panel(panelHead("text", "Fonts"),
			group(radioRow("font_choice", "Font", "The typeface used across the page", [["font_2026", "Stylised"], ["font_2025", "Simple"], ["hyperlegible", "Hyperlegible"], ["custom", "Custom"]]),
				textRow("font", "Custom font", "Font names to use, in order (e.g. Inter, Segoe UI)", "Inter, system-ui", { disabled: (st) => st.font_choice !== "custom" }),
				switchRow("font_serif", "Use serif for headings", "Give big titles a touch of serif"), switchRow("font_emoji", "Use Noto Color Emoji", "Show the same emoji style everywhere")),
			group(rangeRow("font_weight", "Font weight", "How heavy regular text is", 100, 600, 10), rangeRow("font_weight_medium", "Medium weight", "How heavy semi-bold text is", 400, 750, 10), rangeRow("font_weight_bold", "Bold weight", "How heavy bold text is", 500, 900, 10))),
		panel(panelHead("photo", "Artwork"),
			group(radioRow("avatar_radius", "Avatar shape", "The corner style of profile pictures", [["circle", "Circle"], ["squircle", "Squircle"], ["square", "Square"]]),
				switchRow("show_disc_image", "Show cover disc", "Tuck a disc behind course covers in page headers"), switchRow("grid_glow", "Glow behind covers", "A soft coloured glow behind cover art"),
				radioRow("static_gifs", "Animated images", "Whether GIFs play on their own", [["always", "Always animate"], ["hover", "Only on hover"], ["never", "Never"]]))),
		panel(panelHead("wave", "Miscellaneous"), group(switchRow("rain", "Rain", "Let it rain across the top of the page (needs motion on)"))),
	] },
	{ id: "interface", name: "Interface", icon: "layout-manage", build: () => [
		panel(panelHead("banner", "Backdrop"),
			group(switchRow("banner", "Blurred backdrop", "Show the course or profile image, blurred, behind the page", { icon: "banner" }),
				textRow("bannerUrl", "Custom backdrop", "Use this image everywhere instead (leave empty to pick from the page)", "https://…"))),
		panel(panelHead("layout-manage", "Layout"), group(switchRow("wide", "Full-width content", "Let the page use all the room your screen has"))),
		panel(panelHead("rabbit", "Quick switcher"), group(switchRow("rabbit", "Use the quick switcher", "Press Ctrl/⌘ + K (or /) to jump to courses, sections, activities, pages and settings"))),
		panel(panelHead("layout-manage", "Courses"), group(
			switchRow("course_nav", "Section list", "Replace the theme's tile carousel with a compact list of the course's sections"),
			switchRow("file_preview", "Preview files", "Open PDFs, images, video, audio and text in a dialog (Ctrl/⌘/Shift-click opens normally)"),
			switchRow("activity_popup", "Open activities in a popout", "Assignments, forums, pages and more open over the course so closing them brings you right back (Ctrl/⌘/Shift-click opens normally)"),
			switchRow("confetti", "Celebrate submissions", "A little confetti when an assignment is submitted"),
			switchRow("unread", "New markers", "Flag activities that appeared since you last looked, and count them on course cards (courses you have opened)"),
			switchRow("shortcuts", "Keyboard shortcuts", "[ ] sections · g then d/c/a/g/m/p to go places · j k through activities · ? for the full list"))),
		panel(panelHead("layout-manage", "Dashboard"), group(
			switchRow("deadlines", "Due soon", "List upcoming and overdue deadlines at the top of the dashboard"),
			switchRow("resume", "Continue where you left off", "Jump back to the last pages you opened, and remember how far you scrolled"),
			switchRow("course_tools", "Course card tools", "Pin, rename or hide courses on your dashboard and course list (stored in this browser)"))),
	] },
	{ id: "accessibility", name: "Accessibility", icon: "accessibility", build: () => [
		panel(panelHead("accessibility", "Motion"), group(switchRow("reduced_motion", "Reduced motion", "Cut back on animations and transitions (also follows your device)"), switchRow("reduced_flashing", "Reduced flashing", "Tone down flashes, glows and quick pulses"))),
		panel(panelHead("text", "Text"), group(switchRow("underline_links", "Underline links", "Always underline links so they stand out"), switchRow("show_scroller", "Show the scrollbar", "Keep the page's scrollbar visible"))),
	] },
	{ id: "seasonal", name: "Seasonal", icon: "season", build: () => [
		panel(panelHead("season", "Seasonal timeline"), seasonTimeline()),
		panel(panelHead("snow", "Particles"),
			group(switchRow("seasonal", "Enable seasons", "Let the page dress up for the time of year"),
				radioRow("seasonal_particles", "Particles", "How many falling flakes and leaves to show", [["all", "All"], ["less", "Fewer"], ["none", "None"]], { disabled: (st) => !st.seasonal }),
				checkboxRow("seasonal_particles_fps", "Performance mode", "Simpler particles that use less of your device", { disabled: (st) => !st.seasonal }))),
		panel(panelHead("pride", "Effects"), group(checkboxRow("seasonal_overlays", "Overlays", "Seasonal decorations along the top of cards", { disabled: (st) => !st.seasonal }), checkboxRow("seasonal_masks", "Masks", "Seasonal shapes on the page header", { disabled: (st) => !st.seasonal }))),
	] },
	{ id: "advanced", name: "Advanced", icon: "advanced", build: () => [
		panel(panelHead("advanced", "Troubleshooting"), group(
			actionRow("Copy page structure", "Copies this page's tags, ids and classes (no text) so the layout can be adapted to a custom theme", "Copy", () => { document.dispatchEvent(new CustomEvent("moodleflow:copy-structure")); }),
			actionRow("Reset everything", "Put every moodleflow setting back to its default", "Reset all", () => { if (confirm("Reset every moodleflow setting?")) s.reset(); }))),
	] },
];

const built = new Map<string, HTMLElement[]>();
/** Builds every tab once (so search can span them); rows keep their handlers across tab switches. */
export function buildAll(): Map<string, HTMLElement[]> {
	if (built.size) return built;
	for (const t of TABS) {
		const panels = t.build();
		panels.forEach((p) => p.setAttribute("data-tab", t.id));
		built.set(t.id, panels);
	}
	return built;
}

/** Show one tab, or — with a query — every row across all tabs that matches. */
export function showTab(id: string, query = ""): void {
	const q = query.trim().toLowerCase();
	for (const [tab, panels] of built) {
		for (const p of panels) {
			if (!q) { p.hidden = tab !== id; p.querySelectorAll<HTMLElement>("[data-search]").forEach((r) => r.removeAttribute("data-mf-nomatch")); continue; }
			let any = false;
			p.querySelectorAll<HTMLElement>("[data-search]").forEach((r) => {
				const hit = r.getAttribute("data-search")!.includes(q);
				r.toggleAttribute("data-mf-nomatch", !hit);
				any ||= hit && !r.matches("[hidden]");
			});
			p.hidden = !any;
		}
	}
}

/** Side column: search, import / export / reset, version line. */
export function sideColumn(version: string, onSearch: (q: string) => void): HTMLElement[] {
	const input = h("input", { type: "search", class: "input", placeholder: "Search for settings", "aria-label": "Search for settings" });
	input.oninput = () => onSearch(input.value);
	const act = (type: string, text: string, fn: () => void) => { const b = h("button", { type: "button", class: "btn side-action icon-mask", "data-type": type }, text); b.onclick = fn; return b; };
	return [
		h("section", {}, input),
		h("section", { class: "side-actions" },
			act("import", "Import", () => {
				const raw = prompt("Paste exported moodleflow settings");
				if (!raw) return;
				try {
					const clean = s.sanitize(JSON.parse(raw));
					if (!Object.keys(clean).length) throw new Error();
					s.set(clean);
				} catch { alert("That isn't valid moodleflow settings JSON."); }
			}),
			act("export", "Export", () => { navigator.clipboard.writeText(JSON.stringify(s.get())).catch(() => prompt("Copy your settings:", JSON.stringify(s.get()))); }),
			act("reset", "Reset", () => { if (confirm("Reset every moodleflow setting?")) s.reset(); })),
		h("section", {}, h("label", { class: "card-tip" }, `moodleflow ${version} — bleh by katelyn`)),
	];
}

export function mountSettingsControls(): void { s.subscribe((st) => updaters.forEach((u) => u(st))); }
export function syncSettingsControls(): void { updaters.forEach((u) => u(s.get())); }
