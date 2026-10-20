// The dashboard, laid out the way bleh lays out a profile: the page header carries the greeting and the numbers that matter,
// the main column holds "Continue" and every course as a cover grid (with All / In progress / Past tabs), and the sidebar
// column holds what is due (deadlines.ts), recent pages and shortcuts as flat sections. Moodle's own blocks are hidden,
// not removed, and come back with the "New dashboard layout" switch (or in edit mode).
import * as settings from "./settings";
import * as m from "./moodle";
import { call, read, write, homeSlot, isDashboard, siteRoot } from "./api";
import { load as loadDue, bucket, type DueEvent } from "./deadlines";
import { visits } from "./resume";
import { totalFresh } from "./unread";
import { onDomChange } from "./watch";
import { h } from "./dom";

export type Course = { id: number; fullname: string; viewurl: string; courseimage?: string; progress?: number | null; coursecategory?: string; startdate?: number; enddate?: number; isfavourite?: boolean; hidden?: boolean };
export type Tab = "all" | "inprogress" | "past" | "favourites";
const KEY = "home_courses_all", TTL = 10 * 60e3;

/** Pure: "Good morning" … for an hour of the day. */
export const greeting = (hour: number): string => (hour < 6 ? "Good night" : hour < 12 ? "Good morning" : hour < 20 ? "Good afternoon" : "Good evening");
/** Pure: the first word of a display name, tidied ("TOMAS PALMA SÁNCI" → "Tomas"). */
export function firstName(full: string): string {
	const w = full.trim().split(/\s+/)[0] ?? "";
	return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "";
}
/** Pure: where a course is in its life, from its start / end dates (seconds; 0 or missing = no date). */
export function courseState(c: Pick<Course, "startdate" | "enddate">, now: number): "future" | "inprogress" | "past" {
	if (c.enddate && c.enddate < now) return "past";
	if (c.startdate && c.startdate > now) return "future";
	return "inprogress";
}
/** Pure: the courses a tab shows. */
export function inTab(list: Course[], tab: Tab, now: number): Course[] {
	if (tab === "all") return list;
	if (tab === "favourites") return list.filter((c) => c.isfavourite);
	return list.filter((c) => courseState(c, now) === tab);
}

/** The signed-in user's name, read once from their profile page title ("Sam Student: Public profile | Site") and kept. */
async function userName(): Promise<string> {
	const saved = GM_getValue("home_name", "");
	if (saved) return saved;
	try {
		const html = await (await fetch(`${siteRoot()}/user/profile.php`, { credentials: "include" })).text();
		const name = /<title>\s*([^:<|]+?)\s*:/.exec(html)?.[1]?.trim() ?? "";
		if (name) GM_setValue("home_name", name);
		return name;
	} catch { return ""; }
}

async function courses(): Promise<Course[]> {
	const hit = read<{ at: number; list: Course[] }>(KEY, { at: 0, list: [] });
	if (Date.now() - hit.at < TTL && hit.list.length) return hit.list;
	const res = await call<{ courses: Course[] }>("core_course_get_enrolled_courses_by_timeline_classification",
		{ classification: "all", limit: 0, offset: 0, sort: "ul.timeaccess desc", customfieldname: "", customfieldvalue: "", requiredfields: ["id", "fullname", "shortname", "showcoursecategory", "showshortname", "visible", "enddate"] }); // the list Moodle's own overview sends: other lists are rejected
	const list = (res?.courses ?? hit.list).filter((c) => !c.hidden);
	if (res) write(KEY, { at: Date.now(), list });
	return list;
}

const hue = (id: number) => (id * 47) % 360;
const gradient = (id: number) => `linear-gradient(135deg, oklch(0.55 0.12 ${hue(id)}), oklch(0.35 0.1 ${hue(id) + 50}))`;
const reduceMotion = () => settings.get().reduced_motion || matchMedia("(prefers-reduced-motion: reduce)").matches;
const icon = (name: string) => h("span", { class: "mf-glyph", style: `--mask: var(--icon-16-${name})`, "aria-hidden": "true" });

function tile(c: Course, i: number, animate: boolean): HTMLElement {
	const pct = typeof c.progress === "number" ? Math.round(c.progress) : null;
	const bar = h("span", { class: "mf-tile-bar", style: `width:${animate ? 0 : pct}%` });
	if (animate && pct !== null) setTimeout(() => { bar.style.width = `${pct}%`; }, 250 + i * 40);
	const state = courseState(c, Date.now() / 1000);
	return h("article", { class: "mf-tile", "data-course-id": String(c.id), "data-i": "", style: `--i:${Math.min(i, 12) + 3}` },
		h("a", { class: "mf-tile-link", href: c.viewurl, "aria-label": c.fullname },
			h("div", { class: "mf-tile-cover", style: `background-image:${c.courseimage ? `url(${JSON.stringify(c.courseimage)})` : gradient(c.id)}` },
				pct === null ? null : h("div", { class: "mf-tile-progress", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" }, bar),
				state === "past" ? h("span", { class: "mf-tile-flag" }, "Past") : null),
			h("div", { class: "mf-tile-title coursename" }, c.fullname),
			h("div", { class: "mf-tile-sub" }, [c.coursecategory, pct === null ? null : pct >= 100 ? "Done" : `${pct}%`].filter(Boolean).join(" · "))));
}
const skeletons = (n: number) => Array.from({ length: n }, () => h("div", { class: "mf-tile mf-skel" }, h("div", { class: "mf-tile-cover" }), h("span", { class: "mf-skel-line" }), h("span", { class: "mf-skel-line short" })));

let filter = "";
let tab: Tab = "all";
let animateNext = true; // entrance animations play once per page load, not on every repaint
let lastSig = "";
type Data = { list: Course[]; name: string; events: DueEvent[]; loading: boolean };
let current: Data = { list: [], name: "", events: [], loading: true };

const matches = (c: Course) => !filter.trim() || `${c.fullname} ${c.coursecategory ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase());
const shownCourses = (d: Data) => inTab(d.list, tab, Date.now() / 1000).filter(matches);

/** The page header becomes bleh's profile header: your photo, the greeting, the date and the numbers. */
function decorateHeader(d: Data, week: DueEvent[], overdue: number, fresh: number): void {
	const header = document.querySelector<HTMLElement>(".page-content > .page-header:not([data-mf-settings])");
	if (!header) return;
	const now = new Date();
	const info = header.querySelector(".main-info");
	if (!info) return;
	info.replaceChildren(
		h("div", { class: "sub-text" }, now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })),
		h("h1", { class: "page-header-title generic-page-title" }, `${greeting(now.getHours())}${d.name ? ", " + firstName(d.name) : ""}`),
		h("dl", { class: "mf-meta" },
			...[["Courses", String(d.list.length)], ["Due this week", String(week.length - overdue)], overdue ? ["Overdue", String(overdue)] : null, fresh ? ["New", String(fresh)] : null]
				.filter((x): x is string[] => !!x).flatMap(([k, v]) => [h("div", { class: "mf-meta-item" }, h("dd", {}, v), h("dt", {}, k))])));
	const user = m.currentUser();
	if (user?.avatar && !header.querySelector(".page-header-avatar-list")) {
		header.classList.remove("for-home", "for-album");
		header.classList.add("for-profile");
		header.prepend(h("div", { class: "page-header-avatar-list" }, h("div", { class: "page-header-avatar colourful" }, h("img", { src: user.avatar.replace(/\/f[12](\?|$)/, "/f1$1"), alt: "" }), h("div", { class: "page-header-avatar-glow colourful" }))));
	}
}

function sideSections(): void {
	const side = homeSlot("side");
	if (!side) return;
	side.querySelector(".mf-recent")?.remove();
	side.querySelector(".mf-shortcuts")?.remove();
	const recent = visits().slice(1, 6);
	if (recent.length) side.append(h("section", { class: "mf-block mf-recent", "data-i": "", style: "--i:4" },
		h("div", { class: "mf-block-head" }, h("h3", {}, "Recently visited")),
		h("ul", { class: "mf-rows" }, ...recent.map((v) => h("li", {}, h("a", { class: "mf-row", href: v.url }, icon("recent"), h("span", { class: "mf-row-main" }, h("span", { class: "mf-row-title" }, v.title), v.sub ? h("span", { class: "mf-row-sub" }, v.sub) : null)))))));
	const links: [string, string, string][] = [["Courses", "/my/courses.php", "library"], ["Calendar", "/calendar/view.php?view=month", "calendar"], ["Grades", "/grade/report/overview/index.php", "chart-bar"], ["Messages", "/message/index.php", "inbox"], ["Private files", "/user/files.php", "page"]];
	side.append(h("section", { class: "mf-block mf-shortcuts", "data-i": "", style: "--i:5" },
		h("div", { class: "mf-block-head" }, h("h3", {}, "Shortcuts")),
		h("ul", { class: "mf-rows" }, ...links.map(([label, path, ic]) => h("li", {}, h("a", { class: "mf-row", href: siteRoot() + path }, icon(ic), h("span", { class: "mf-row-main" }, h("span", { class: "mf-row-title" }, label))))))));
}

function paint(d: Data): void {
	const st = settings.get();
	const main = homeSlot("main");
	if (!main) return;
	const animate = animateNext && !reduceMotion();
	const root = main.parentElement!;
	root.classList.toggle("mf-enter", animate);
	document.querySelector(".content")?.classList.toggle("mf-enter", animate);
	const t = Math.floor(Date.now() / 1000);
	const week = d.events.filter((e) => e.timesort < t + 7 * 86400);
	const overdue = week.filter((e) => bucket(e.timesort, t) === "Overdue").length;
	decorateHeader(d, week, overdue, st.unread ? totalFresh() : 0);
	main.querySelector(".mf-continue-block")?.remove();
	main.querySelector(".mf-courses")?.remove();
	const last = visits()[0];
	if (last) {
		const cover = d.list.find((c) => String(c.id) === last.cid)?.courseimage;
		main.prepend(h("section", { class: "mf-block mf-continue-block", "data-i": "", style: "--i:2" },
			h("div", { class: "mf-block-head" }, h("h3", {}, "Continue")),
			h("a", { class: "mf-continue", href: last.url },
				h("div", { class: "mf-continue-art", style: cover ? `background-image:url(${JSON.stringify(cover)})` : last.cid ? `background-image:${gradient(+last.cid)}` : "" }),
				h("div", { class: "mf-continue-text" }, h("strong", {}, last.title), last.sub ? h("span", { class: "mf-row-sub" }, last.sub) : null),
				h("span", { class: "btn flex-button mf-continue-go" }, "Resume", h("span", { class: "mf-arrow", "aria-hidden": "true" }, "→")))));
	}
	current = d;
	const now = Date.now() / 1000;
	const tabs: [Tab, string][] = [["all", "All"], ["inprogress", "In progress"], ["past", "Past"]];
	if (d.list.some((c) => c.isfavourite)) tabs.push(["favourites", "Favourites"]);
	const seg = h("div", { class: "mf-seg", role: "tablist" }, ...tabs.map(([id, name]) => {
		const n = inTab(d.list, id, now).length;
		const b = h("button", { type: "button", role: "tab", class: "mf-seg-item", "aria-selected": String(tab === id) }, name, h("span", { class: "mf-seg-n" }, String(n)));
		b.onclick = () => { tab = id; seg.querySelectorAll("[role=tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); paintGrid(); };
		return b;
	}));
	const search = h("input", { type: "search", class: "input mf-filter", placeholder: "Find a course", "aria-label": "Find a course", value: filter });
	search.addEventListener("input", () => { filter = search.value; paintGrid(); });
	const grid = h("div", { class: "mf-grid" });
	main.append(h("section", { class: "mf-block mf-courses", "data-i": "", style: "--i:3" },
		h("div", { class: "mf-block-head" }, h("h3", {}, "Courses"), seg, d.list.length > 6 ? search : null), grid));
	fillGrid(grid, d.loading && !d.list.length ? skeletons(8) : null, animate);
	sideSections();
	animateNext = false;
	if (animate) setTimeout(() => { root.classList.remove("mf-enter"); document.querySelector(".content")?.classList.remove("mf-enter"); }, 1800);
}
function fillGrid(grid: Element, placeholders: Element[] | null, animate: boolean): void {
	if (placeholders) { grid.replaceChildren(...placeholders); return; }
	const shown = shownCourses(current);
	grid.replaceChildren(...(shown.length ? shown.map((c, i) => tile(c, i, animate)) : [h("p", { class: "mf-row-sub" }, filter.trim() ? "No course matches that." : "No courses here yet.")]));
	document.dispatchEvent(new CustomEvent("mf:cards"));
}
/** Switching tabs or typing in the filter swaps only the grid, so nothing else re-animates and the input keeps focus. */
function paintGrid(): void {
	const grid = document.querySelector(".mf-grid");
	if (grid) fillGrid(grid, null, false);
}

/** Pointer-follow highlight on the cover tiles, skipped with reduced motion. */
function trackPointer(): void {
	document.addEventListener("pointermove", (e) => {
		const el = (e.target as Element).closest?.<HTMLElement>(".mf-tile:not(.mf-skel), .mf-continue");
		if (!el || reduceMotion()) return;
		const r = el.getBoundingClientRect();
		el.style.setProperty("--mx", `${e.clientX - r.left}px`);
		el.style.setProperty("--my", `${e.clientY - r.top}px`);
	}, { passive: true });
}

async function render(): Promise<void> {
	const st = settings.get();
	const on = st.home && isDashboard() && !document.body.classList.contains("editing");
	document.body.toggleAttribute("data-mf-home", on);
	if (!on) { document.querySelector(".mf-continue-block")?.remove(); document.querySelector(".mf-courses")?.remove(); document.querySelector(".mf-recent")?.remove(); document.querySelector(".mf-shortcuts")?.remove(); homeSlot("side"); return; }
	// paint at once from whatever we remember (skeleton tiles on the very first visit), then refresh from the network
	const cached = read<{ at: number; list: Course[] }>(KEY, { at: 0, list: [] });
	paint({ list: cached.list, name: GM_getValue("home_name", ""), events: read<{ events: DueEvent[] }>("deadlines", { events: [] }).events, loading: true });
	const [events, list, name] = await Promise.all([st.deadlines ? loadDue() : Promise.resolve([]), courses(), userName()]);
	const sig = JSON.stringify([list.map((c) => [c.id, c.progress, c.fullname]), name, events.map((e) => e.id), visits()[0]?.url]);
	if (sig !== lastSig || current.loading) { lastSig = sig; paint({ list, name, events, loading: false }); }
}

/** Moodle's own dashboard content is hidden (attribute, not removal) while the new layout is on; late AJAX blocks too.
 *  Walks up from our root to the main box and hides every sibling on the way, so a site's own plugin content, wherever it
 *  sits in the main region, goes too. */
function hideMoodle(): void {
	const on = settings.get().home && isDashboard() && !document.body.classList.contains("editing");
	let node: Element | null = document.querySelector(".mf-home");
	while (node?.parentElement && node.id !== "region-main-box" && !node.parentElement.classList.contains("mf-moodle")) {
		for (const sib of node.parentElement.children) if (sib !== node) sib.toggleAttribute("data-mf-replaced", on);
		node = node.parentElement;
	}
}

export function mountHome(): void {
	if (!isDashboard()) return;
	void render();
	trackPointer();
	onDomChange(hideMoodle);
	settings.subscribe((_, c) => { if (c.some((k) => ["home", "deadlines", "unread"].includes(k))) { lastSig = ""; void render(); hideMoodle(); } });
}
