// Course navigation: one "Sections" list in the sidebar, built from whatever the page offers — the classroom theme's
// tile carousel (which it replaces: tiles are huge and need sideways scrolling) or the sections of a full course page
// (highlighting the one in view). Also [ / ] for previous / next section. Moodle's own nodes are hidden, never removed.
import * as settings from "./settings";
import { h } from "./dom";
import { onDomChange } from "./watch";

export type Entry = { name: string; href: string; active: boolean; img?: string; count?: number };

const TILES = "[data-block='xtend_course_navigation'] .classroom-course-section[data-url]";
const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";

function fromTiles(): Entry[] {
	const seen = new Set<string>(); // the carousel repeats its tiles to loop
	return [...document.querySelectorAll<HTMLElement>(TILES)].filter((t) => !seen.has(t.dataset.url!) && !!seen.add(t.dataset.url!)).map((t) => ({
		name: t.dataset.content || text(t.querySelector(".classroom-course-section-title, .classroom-course-section-name")) || t.getAttribute("aria-label")?.replace(/^[^:]*:\s*/, "") || "Section",
		href: t.dataset.url!, active: t.classList.contains("classroom-selected"),
		img: t.querySelector<HTMLElement>(".classroom-course-section-image")?.style.backgroundImage || undefined,
	}));
}
function fromPage(): Entry[] {
	return [...document.querySelectorAll<HTMLElement>(".course-content li.section[data-number]")].map((s) => ({
		name: s.dataset.sectionname || text(s.querySelector(".sectionname")) || `Section ${s.dataset.number}`,
		href: `#${s.id}`, active: false, count: s.querySelectorAll("li.activity").length,
	}));
}
/** Pure: the neighbours of the active entry. */
export function neighbours(list: Pick<Entry, "active">[]): { prev?: number; next?: number } {
	const i = list.findIndex((e) => e.active);
	return i < 0 ? {} : { prev: i > 0 ? i - 1 : undefined, next: i < list.length - 1 ? i + 1 : undefined };
}

let entries: Entry[] = [];
export const courseSections = (): Entry[] => entries;
let card: HTMLElement | undefined;
let signature = "";
let spy: IntersectionObserver | undefined;

function render(side: Element): void {
	card?.remove();
	spy?.disconnect();
	if (entries.length < 2) { card = undefined; return; }
	const items = entries.map((e) => {
		const a = h("a", { class: "mf-section", href: e.href, "aria-current": e.active ? "page" : "false" },
			h("span", { class: "mf-section-thumb", style: e.img ? `background-image:${e.img}` : "" }),
			h("span", { class: "mf-section-name" }, e.name), e.count ? h("span", { class: "mf-section-count" }, String(e.count)) : null);
		return Object.assign(h("li", {}, a), { entry: e, a });
	});
	const list = h("ol", { class: "mf-sections" }, ...items);
	const filter = entries.length > 8 ? h("input", { type: "search", class: "input", placeholder: "Filter sections", "aria-label": "Filter sections" }) : null;
	if (filter) filter.oninput = () => { const q = filter.value.trim().toLowerCase(); for (const it of items) it.hidden = !!q && !it.entry.name.toLowerCase().includes(q); };
	const zip = document.querySelector<HTMLAnchorElement>('a[href*="downloadcontent.php"]'); // Moodle's own "Download course content", when the site enables it
	card = h("section", { class: "mf-coursenav" }, h("h4", {}, "Sections"), filter, list, zip ? h("a", { class: "btn flex-button", href: zip.href }, "Download all files") : null);
	side.prepend(card);
	card.querySelector("[aria-current=page]")?.scrollIntoView({ block: "nearest" });
	if (entries.some((e) => e.href.startsWith("#")) && !entries.some((e) => e.active)) {
		spy = new IntersectionObserver((hits) => {
			const top = hits.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
			if (top) for (const it of items) it.a.setAttribute("aria-current", it.entry.href === `#${top.target.id}` ? "location" : "false");
		}, { rootMargin: "-90px 0px -60% 0px" });
		for (const it of items) { const t = document.querySelector(it.entry.href); if (t) spy.observe(t); }
	}
}

function refresh(): void {
	const side = document.querySelector(".col-sidebar");
	if (!side) return;
	if (!settings.get().course_nav) {
		card?.remove(); card = undefined; entries = []; signature = "";
		document.querySelectorAll("[data-mf-replaced]").forEach((n) => n.removeAttribute("data-mf-replaced"));
		return;
	}
	const tiles = fromTiles();
	entries = tiles.length ? tiles : fromPage();
	if (tiles.length) document.querySelectorAll("[data-block='xtend_course_navigation']").forEach((n) => n.setAttribute("data-mf-replaced", ""));
	const sig = JSON.stringify(entries.map((e) => [e.href, e.active, e.name]));
	if (sig === signature && card?.isConnected) return;
	signature = sig;
	render(side);
}

/** `[` / `]`: previous / next section (the theme's own buttons when there is no list). */
function onKey(e: KeyboardEvent): void {
	if (!settings.get().shortcuts || e.ctrlKey || e.metaKey || e.altKey || (e.key !== "[" && e.key !== "]")) return;
	if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
	const dir = e.key === "[" ? "prev" : "next";
	const n = neighbours(entries)[dir];
	const link = n !== undefined ? entries[n].href : document.querySelector<HTMLAnchorElement>(`.section-navigation .${dir}section a`)?.href;
	if (link) location.assign(link);
}

export function mountCourseNav(): void {
	let t = 0;
	onDomChange(() => { clearTimeout(t); t = window.setTimeout(refresh, 60); }); // blocks can arrive over AJAX
	settings.subscribe((_, changed) => { if (changed.includes("course_nav")) refresh(); });
	addEventListener("keydown", onKey);
}
