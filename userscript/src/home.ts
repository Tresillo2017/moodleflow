// The dashboard, redesigned: a greeting with the numbers that matter, a "continue" hero, your courses as cover cards with
// progress, and (in the side column, from deadlines.ts) what is due and the week ahead. Moodle's own blocks are hidden,
// not removed, and come back with the "New dashboard layout" switch (or in edit mode).
import * as settings from "./settings";
import { call, read, write, homeSlot, isDashboard, siteRoot } from "./api";
import { load as loadDue, bucket } from "./deadlines";
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

const chip = (text: string, tone = "") => h("span", { class: `mf-chip ${tone}`.trim() }, text);
const quick = (label: string, href: string, icon: string) => h("a", { class: "btn mf-quick-link icon", href, style: `--mask: var(--icon-16-${icon})` }, label);
const hue = (id: number) => (id * 47) % 360;
const gradient = (id: number) => `linear-gradient(135deg, oklch(0.55 0.12 ${hue(id)}), oklch(0.35 0.1 ${hue(id) + 50}))`;

function courseCard(c: Course): HTMLElement {
	const cover = h("div", { class: "mf-course-cover", style: c.courseimage ? `background-image:url(${JSON.stringify(c.courseimage)})` : `background-image:${gradient(c.id)}` });
	const pct = typeof c.progress === "number" ? Math.round(c.progress) : null;
	return h("article", { class: "mf-course-card", "data-course-id": String(c.id) },
		h("a", { class: "mf-course-link", href: c.viewurl, "aria-label": c.fullname }, cover,
			h("div", { class: "mf-course-body" },
				c.coursecategory ? h("div", { class: "mf-course-cat" }, c.coursecategory) : null,
				h("h3", { class: "coursename" }, c.fullname),
				pct === null ? null : h("div", { class: "mf-progress-row" },
					h("div", { class: "mf-progress", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" }, h("span", { class: "mf-progress-bar", style: `width:${pct}%` })),
					h("span", { class: "mf-progress-text" }, `${pct}%`)))));
}

async function render(): Promise<void> {
	const st = settings.get();
	document.body.toggleAttribute("data-mf-home", st.home && isDashboard() && !document.body.classList.contains("editing"));
	document.querySelector(".mf-home-hero")?.replaceChildren();
	document.querySelector(".mf-home-courses")?.remove();
	document.querySelector(".mf-continue")?.remove();
	const hero = st.home ? homeSlot("hero") : null, main = st.home ? homeSlot("main") : null;
	if (!hero || !main) return;
	const now = new Date();
	const [events, list, name] = await Promise.all([st.deadlines ? loadDue() : Promise.resolve([]), courses(), userName()]);
	const t = Math.floor(now.getTime() / 1000);
	const week = events.filter((e) => e.timesort < t + 7 * 86400);
	const overdue = week.filter((e) => bucket(e.timesort, t) === "Overdue").length;
	const fresh = st.unread ? totalFresh() : 0;
	hero.replaceChildren(h("section", { class: "mf-hero" },
		h("div", { class: "mf-hero-text" },
			h("h1", {}, `${greeting(now.getHours())}${name ? ", " + firstName(name) : ""}`),
			h("p", {}, now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }))),
		h("div", { class: "mf-chips" }, chip(`${week.length - overdue} due this week`, week.length - overdue ? "" : "quiet"), overdue ? chip(`${overdue} overdue`, "bad") : null, fresh ? chip(`${fresh} new`, "good") : null),
		h("div", { class: "mf-quick" }, quick("Courses", `${siteRoot()}/my/courses.php`, "library"), quick("Calendar", `${siteRoot()}/calendar/view.php?view=month`, "calendar"),
			quick("Grades", `${siteRoot()}/grade/report/overview/index.php`, "chart-bar"), quick("Messages", `${siteRoot()}/message/index.php`, "inbox"))));
	// continue: the last page you were on, with its course's cover
	const last = visits()[0];
	if (last) {
		const cover = list.find((c) => String(c.id) === last.cid)?.courseimage;
		main.prepend(h("a", { class: "mf-continue", href: last.url },
			h("div", { class: "mf-continue-art", style: cover ? `background-image:url(${JSON.stringify(cover)})` : last.cid ? `background-image:${gradient(+last.cid)}` : "" }),
			h("div", { class: "mf-continue-text" }, h("span", { class: "mf-continue-label" }, "Continue where you left off"), h("strong", {}, last.title), last.sub ? h("span", { class: "mf-due-meta" }, last.sub) : null),
			h("span", { class: "btn flex-button mf-continue-go" }, "Resume")));
	}
	const grid = h("div", { class: "mf-course-grid" }, ...list.map(courseCard));
	main.append(h("section", { class: "mf-home-courses" }, h("h4", {}, "My courses", h("a", { class: "mf-see-all", href: `${siteRoot()}/my/courses.php` }, "See all")), list.length ? grid : h("p", { class: "mf-due-meta" }, "No courses in progress.")));
	grid.dispatchEvent(new Event("mf:cards")); // course_tools picks the new cards up through the DOM observer
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
	onDomChange(hideMoodle);
	settings.subscribe((_, c) => { if (c.some((k) => ["home", "deadlines", "unread"].includes(k))) { void render(); hideMoodle(); } });
}
