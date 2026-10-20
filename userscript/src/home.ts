// The dashboard, redesigned: a greeting with the numbers that matter, a "continue" hero, your courses as cover cards with
// progress, and (in the side column, from deadlines.ts) what is due and the week ahead. Moodle's own blocks are hidden,
// not removed, and come back with the "New dashboard layout" switch (or in edit mode).
import * as settings from "./settings";
import { call, read, write, homeSlot, isDashboard, siteRoot } from "./api";
import { load as loadDue, bucket, type DueEvent } from "./deadlines";
import { visits } from "./resume";
import { totalFresh } from "./unread";
import { onDomChange } from "./watch";
import { h } from "./dom";

export type Course = { id: number; fullname: string; viewurl: string; courseimage?: string; progress?: number | null; coursecategory?: string };
const KEY = "home_courses", TTL = 10 * 60e3;

/** Pure: "Good morning" … for an hour of the day. */
export const greeting = (hour: number): string => (hour < 6 ? "Good night" : hour < 12 ? "Good morning" : hour < 20 ? "Good afternoon" : "Good evening");
/** Pure: the first word of a display name, tidied ("TOMAS PALMA SÁNCI" → "Tomas"). */
export function firstName(full: string): string {
	const w = full.trim().split(/\s+/)[0] ?? "";
	return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "";
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
		{ classification: "inprogress", limit: 0, offset: 0, sort: "ul.timeaccess desc", customfieldname: "", customfieldvalue: "", requiredfields: ["id", "fullname", "shortname", "showcoursecategory", "showshortname", "visible", "enddate"] }); // the list Moodle's own overview sends: other lists are rejected
	const list = res?.courses ?? hit.list;
	if (res) write(KEY, { at: Date.now(), list });
	return list;
}

const chip = (text: string, tone = "", i = 0) => h("span", { class: `mf-chip ${tone}`.trim(), style: `--i:${i}` }, text);
const quick = (label: string, href: string, icon: string, i: number) => h("a", { class: "btn mf-quick-link icon", href, style: `--mask: var(--icon-16-${icon});--i:${i}` }, label);
const hue = (id: number) => (id * 47) % 360;
const gradient = (id: number) => `linear-gradient(135deg, oklch(0.55 0.12 ${hue(id)}), oklch(0.35 0.1 ${hue(id) + 50}))`;
const reduceMotion = () => settings.get().reduced_motion || matchMedia("(prefers-reduced-motion: reduce)").matches;

function courseCard(c: Course, i: number, animate: boolean): HTMLElement {
	const pct = typeof c.progress === "number" ? Math.round(c.progress) : null;
	const bar = h("span", { class: "mf-progress-bar", style: `width:${animate ? 0 : pct}%` });
	if (animate && pct !== null) setTimeout(() => { bar.style.width = `${pct}%`; }, 250 + i * 70); // grows from empty, staggered with the cards
	return h("article", { class: "mf-course-card", "data-course-id": String(c.id), "data-i": "", style: `--i:${i + 4}` },
		h("a", { class: "mf-course-link", href: c.viewurl, "aria-label": c.fullname },
			h("div", { class: "mf-course-cover" }, h("div", { class: "mf-course-img", style: `background-image:${c.courseimage ? `url(${JSON.stringify(c.courseimage)})` : gradient(c.id)}` })),
			h("div", { class: "mf-course-body" },
				c.coursecategory ? h("div", { class: "mf-course-cat" }, c.coursecategory) : null,
				h("h3", { class: "coursename" }, c.fullname),
				pct === null ? null : h("div", { class: "mf-progress-row" },
					h("div", { class: "mf-progress", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" }, bar),
					h("span", { class: "mf-progress-text" }, pct >= 100 ? "Done ✓" : `${pct}%`)))));
}
const skeletons = (n: number) => Array.from({ length: n }, () => h("div", { class: "mf-course-card mf-skel" }, h("div", { class: "mf-course-cover" }), h("div", { class: "mf-course-body" }, h("span", { class: "mf-skel-line" }), h("span", { class: "mf-skel-line short" }))));

let filter = "";
let animateNext = true; // entrance animations play once per page load, not on every repaint
let lastSig = "";

type Data = { list: Course[]; name: string; events: DueEvent[]; loading: boolean };
function paint(d: Data): void {
	const st = settings.get();
	const hero = homeSlot("hero"), main = homeSlot("main");
	if (!hero || !main) return;
	const animate = animateNext && !reduceMotion();
	const root = hero.parentElement!;
	root.classList.toggle("mf-enter", animate);
	const now = new Date();
	const t = Math.floor(now.getTime() / 1000);
	const week = d.events.filter((e) => e.timesort < t + 7 * 86400);
	const overdue = week.filter((e) => bucket(e.timesort, t) === "Overdue").length;
	const fresh = st.unread ? totalFresh() : 0;
	hero.replaceChildren(h("section", { class: "mf-hero", "data-i": "", style: "--i:0" },
		h("span", { class: "mf-blob a" }), h("span", { class: "mf-blob b" }),
		h("div", { class: "mf-hero-text" },
			h("h1", {}, `${greeting(now.getHours())}${d.name ? ", " + firstName(d.name) : ""}`),
			h("p", {}, now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) + (d.list.length ? ` · ${d.list.length} course${d.list.length === 1 ? "" : "s"} in progress` : ""))),
		h("div", { class: "mf-chips" }, chip(`${week.length - overdue} due this week`, week.length - overdue ? "" : "quiet", 1), overdue ? chip(`${overdue} overdue`, "bad", 2) : null, fresh ? chip(`${fresh} new`, "good", 3) : null),
		h("div", { class: "mf-quick" }, quick("Courses", `${siteRoot()}/my/courses.php`, "library", 2), quick("Calendar", `${siteRoot()}/calendar/view.php?view=month`, "calendar", 3),
			quick("Grades", `${siteRoot()}/grade/report/overview/index.php`, "chart-bar", 4), quick("Messages", `${siteRoot()}/message/index.php`, "inbox", 5))));
	main.querySelector(".mf-continue")?.remove();
	main.querySelector(".mf-home-courses")?.remove();
	const last = visits()[0];
	if (last) {
		const cover = d.list.find((c) => String(c.id) === last.cid)?.courseimage;
		main.prepend(h("a", { class: "mf-continue", href: last.url, "data-i": "", style: "--i:2" },
			h("div", { class: "mf-continue-art", style: cover ? `background-image:url(${JSON.stringify(cover)})` : last.cid ? `background-image:${gradient(+last.cid)}` : "" }),
			h("div", { class: "mf-continue-text" }, h("span", { class: "mf-continue-label" }, "Continue where you left off"), h("strong", {}, last.title), last.sub ? h("span", { class: "mf-due-meta" }, last.sub) : null),
			h("span", { class: "btn flex-button mf-continue-go" }, "Resume", h("span", { class: "mf-arrow", "aria-hidden": "true" }, "→"))));
	}
	const q = filter.trim().toLowerCase();
	const shown = q ? d.list.filter((c) => `${c.fullname} ${c.coursecategory ?? ""}`.toLowerCase().includes(q)) : d.list;
	const grid = h("div", { class: "mf-course-grid" }, ...(d.loading && !d.list.length ? skeletons(6) : shown.map((c, i) => courseCard(c, i, animate))));
	if (!shown.length && !d.loading) grid.append(h("p", { class: "mf-due-meta" }, q ? "No course matches that." : "No courses in progress."));
	const search = h("input", { type: "search", class: "input mf-course-filter", placeholder: "Find a course", "aria-label": "Find a course", value: filter });
	search.addEventListener("input", () => { filter = search.value; paintGrid(); });
	const section = h("section", { class: "mf-home-courses", "data-i": "", style: "--i:3" },
		h("div", { class: "mf-home-courses-head" }, h("h4", {}, "My courses"), d.list.length > 5 ? search : null, h("a", { class: "mf-see-all", href: `${siteRoot()}/my/courses.php` }, "See all")), grid);
	main.append(section);
	current = d;
	animateNext = false;
	if (animate) setTimeout(() => root.classList.remove("mf-enter"), 1800);
}
let current: Data = { list: [], name: "", events: [], loading: true };
/** Typing in the filter swaps only the grid, so the input keeps focus and nothing re-animates. */
function paintGrid(): void {
	const old = document.querySelector(".mf-course-grid");
	if (!old) return;
	const q = filter.trim().toLowerCase();
	const shown = q ? current.list.filter((c) => `${c.fullname} ${c.coursecategory ?? ""}`.toLowerCase().includes(q)) : current.list;
	old.replaceChildren(...(shown.length ? shown.map((c, i) => courseCard(c, i, false)) : [h("p", { class: "mf-due-meta" }, "No course matches that.")]));
	document.dispatchEvent(new CustomEvent("mf:cards"));
}

/** Pointer-follow glow on the cards (a radial highlight under the cursor), skipped with reduced motion. */
function trackPointer(): void {
	document.addEventListener("pointermove", (e) => {
		const card = (e.target as Element).closest?.<HTMLElement>(".mf-course-card:not(.mf-skel), .mf-continue, .mf-hero");
		if (!card || reduceMotion()) return;
		const r = card.getBoundingClientRect();
		card.style.setProperty("--mx", `${e.clientX - r.left}px`);
		card.style.setProperty("--my", `${e.clientY - r.top}px`);
	}, { passive: true });
}

async function render(): Promise<void> {
	const st = settings.get();
	const on = st.home && isDashboard() && !document.body.classList.contains("editing");
	document.body.toggleAttribute("data-mf-home", on);
	if (!on) { document.querySelector(".mf-home-hero")?.replaceChildren(); document.querySelector(".mf-continue")?.remove(); document.querySelector(".mf-home-courses")?.remove(); return; }
	// paint at once from whatever we remember (skeleton cards on the very first visit), then refresh from the network
	const cached = read<{ at: number; list: Course[] }>(KEY, { at: 0, list: [] });
	paint({ list: cached.list, name: GM_getValue("home_name", ""), events: read<{ events: DueEvent[] }>("deadlines", { events: [] }).events, loading: true });
	const [events, list, name] = await Promise.all([st.deadlines ? loadDue() : Promise.resolve([]), courses(), userName()]);
	const sig = JSON.stringify([list.map((c) => [c.id, c.progress, c.fullname]), name, events.map((e) => e.id), visits()[0]?.url]);
	if (sig !== lastSig || current.loading) { lastSig = sig; paint({ list, name, events, loading: false }); }
}

/** Moodle's own dashboard content is hidden (attribute, not removal) while the new layout is on; late AJAX blocks too. */
function hideMoodle(): void {
	const on = settings.get().home && isDashboard() && !document.body.classList.contains("editing");
	for (const el of document.querySelectorAll("#region-main > *")) {
		if (el.classList.contains("mf-home")) continue;
		el.toggleAttribute("data-mf-replaced", on);
	}
}

export function mountHome(): void {
	if (!isDashboard()) return;
	void render();
	trackPointer();
	onDomChange(hideMoodle);
	settings.subscribe((_, c) => { if (c.some((k) => ["home", "deadlines", "unread"].includes(k))) { lastSig = ""; void render(); hideMoodle(); } });
}
