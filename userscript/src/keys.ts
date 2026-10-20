// Keyboard shortcuts beyond [ ] and / (those live in coursenav.ts / rabbit.ts): "g" then a letter to go somewhere,
// j / k to step through a course page's activities (Enter opens), ? for the cheat sheet.
import * as settings from "./settings";
import { siteRoot } from "./api";
import { h } from "./dom";

export const GO: Record<string, [string, string]> = {
	d: ["Dashboard", "/my/"], c: ["My courses", "/my/courses.php"], a: ["Calendar", "/calendar/view.php?view=upcoming"],
	g: ["Grades", "/grade/report/overview/index.php"], m: ["Messages", "/message/index.php"], p: ["Profile", "/user/profile.php"],
};
const SHEET: [string, string][] = [
	["Ctrl/⌘ K  or  /", "Quick switcher"], ["g then d / c / a / g / m / p", "Dashboard · courses · calendar · grades · messages · profile"],
	["[  ]", "Previous / next section"], ["j  k", "Next / previous activity, Enter to open"], ["?", "This sheet"],
];
const SEQ_MS = 900;

/** Pure: the activity index after pressing j (+1) or k (-1), clamped; `-1` means nothing is selected yet. */
export const step = (cur: number, dir: 1 | -1, count: number): number => (count ? Math.min(count - 1, Math.max(0, cur < 0 ? (dir > 0 ? 0 : count - 1) : cur + dir)) : -1);

let sheet: HTMLElement | undefined;
const closeSheet = () => { sheet?.remove(); sheet = undefined; };
function openSheet(): void {
	if (sheet) return closeSheet();
	const close = h("button", { type: "button", class: "btn modal-close-button icon-mask", "aria-label": "Close", "data-type": "close" }, "Close");
	close.onclick = closeSheet;
	sheet = h("div", { class: "bleh-modals has-dialog" }, h("div", { class: "bleh-modal", role: "dialog", "aria-label": "Keyboard shortcuts" },
		h("div", { class: "bleh-modal-title" }, h("h4", {}, "Keyboard shortcuts")), close,
		h("div", { class: "bleh-modal-body" }, h("dl", { class: "mf-keys" }, ...SHEET.flatMap(([k, d]) => [h("dt", {}, k), h("dd", {}, d)])))));
	sheet.addEventListener("mousedown", (e) => { if (e.target === sheet) closeSheet(); });
	document.body.append(sheet);
}

let cur = -1;
const acts = () => [...document.querySelectorAll<HTMLElement>(".course-content li.activity:not([hidden])")];
function focusActivity(dir: 1 | -1): void {
	const list = acts();
	list.forEach((l) => l.removeAttribute("data-mf-focus"));
	cur = step(cur, dir, list.length);
	list[cur]?.setAttribute("data-mf-focus", "");
	list[cur]?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

export function mountKeys(): void {
	let pending = 0;
	addEventListener("keydown", (e) => {
		if (e.key === "Escape" && sheet) return closeSheet();
		if (!settings.get().shortcuts || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]") || document.querySelector(".bleh-modals.has-dialog:not(:has(.mf-keys))")) return;
		const now = Date.now();
		if (pending && now - pending < SEQ_MS && GO[e.key]) { pending = 0; e.preventDefault(); location.assign(siteRoot() + GO[e.key][1]); return; }
		pending = 0;
		if (e.key === "g") pending = now;
		else if (e.key === "?") openSheet();
		else if (e.key === "j" || e.key === "k") { if (acts().length) { e.preventDefault(); focusActivity(e.key === "j" ? 1 : -1); } }
		else if (e.key === "Enter" && cur >= 0 && e.target === document.body) acts()[cur]?.querySelector<HTMLAnchorElement>("a.aalink[href]")?.click();
	});
}
