// The Assignments page (#moodleflow/assignments): everything still pending in one place, grouped by when it is due, with
// filters by period, course and text. Ticking an item is local (same marker as the dashboard card), never a submission.
import { call, read, write } from "./api";
import { DONE, DAY, ORDER, bucket, type DueEvent } from "./deadlines";
import { h } from "./dom";

type Bucket = (typeof ORDER)[number];
export type Pending = DueEvent & { course: { id?: number; fullname: string } };
type Period = "all" | "Overdue" | "Today" | "Soon" | "Later";
type RawEvent = DueEvent & { action?: { actionable?: boolean }; course?: { id?: number; fullname?: string } };
type Loaded = { events: Pending[]; ok: boolean };

const KEY = "assignments", BACK_DAYS = 45, AHEAD_DAYS = 120, PAGE = 50, MAX_PAGES = 4, LIMIT = PAGE * MAX_PAGES, DONE_MAX = 200; // Moodle refuses more than 50 events per request
const KIND: Record<string, string> = { assign: "Assignment", quiz: "Quiz", forum: "Forum", lesson: "Lesson", workshop: "Workshop", feedback: "Feedback", choice: "Choice", data: "Database" };

/** Pure: "in 3 days", "2 days ago", "now" … relative to `now` (seconds). */
export function relative(timesort: number, now: number): string {
	const mins = Math.round((timesort - now) / 60);
	const abs = Math.abs(mins);
	if (abs < 1) return "now";
	const [n, unit] = abs < 60 ? [abs, "min"] : abs < 1440 ? [Math.round(abs / 60), "h"] : [Math.round(abs / 1440), "day"];
	const label = `${n} ${unit}${unit === "day" && n !== 1 ? "s" : ""}`;
	return mins < 0 ? `${label} ago` : `in ${label}`;
}
/** Pure: events grouped under their due-date heading, in heading order, soonest first inside each. */
export function group<T extends { timesort: number }>(events: readonly T[], now: number): { name: Bucket; items: T[] }[] {
	const sorted = [...events].sort((a, b) => a.timesort - b.timesort);
	return ORDER.map((name) => ({ name, items: sorted.filter((e) => bucket(e.timesort, now) === name) })).filter((g) => g.items.length);
}
/** Pure: does an event fall under a period chip? ("Soon" is tomorrow and the rest of the week.) */
export const inPeriod = (timesort: number, period: Period, now: number): boolean => {
	if (period === "all") return true;
	const b = bucket(timesort, now);
	return period === "Soon" ? b === "Tomorrow" || b === "This week" : b === period;
};

/** Always asks Moodle (a just-submitted assignment must leave the list at once); the saved copy is only the fallback.
 *  Moodle caps a request at 50 events, so later pages continue after the last event we got. */
async function load(): Promise<Loaded> {
	const saved = read<{ events: Pending[] }>(KEY, { events: [] }).events;
	const now = Math.floor(Date.now() / 1000);
	const raw: RawEvent[] = [];
	let from = now - BACK_DAYS * DAY, after = 0;
	for (let page = 0; page < MAX_PAGES; page++) {
		const res = await call<{ events: RawEvent[] }>("core_calendar_get_action_events_by_timesort", { timesortfrom: from, timesortto: now + AHEAD_DAYS * DAY, limitnum: PAGE, ...(after ? { aftereventid: after } : {}) });
		if (!res) return { events: raw.length ? toPending(raw) : saved, ok: false };
		raw.push(...res.events);
		const last = res.events[res.events.length - 1];
		if (res.events.length < PAGE || !last) break;
		from = last.timesort; after = last.id;
	}
	const events = toPending(raw);
	write(KEY, { at: Date.now(), events });
	return { events, ok: true };
}
const toPending = (raw: RawEvent[]): Pending[] => raw.filter((e) => e.action?.actionable !== false)
	.map(({ id, name, timesort, url, modulename, course }): Pending => ({ id, name, timesort, url, modulename, course: { id: course?.id, fullname: course?.fullname ?? "Other" } }));

type State = { events: Pending[]; loading: boolean; failed: boolean; period: Period; course: string; text: string; showDone: boolean };
const doneIds = (): Set<number> => new Set(read<{ ids: number[] }>(DONE, { ids: [] }).ids);
const saveDone = (ids: Iterable<number>): void => write(DONE, { ids: [...ids].slice(-DONE_MAX) });

function row(e: Pending, now: number, done: boolean, onTick: () => void): HTMLElement {
	const b = bucket(e.timesort, now);
	const d = new Date(e.timesort * 1000);
	const later = b === "Later";
	const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
	const tick = h("button", { type: "button", class: "mf-due-tick" + (done ? " is-done" : ""), "aria-label": done ? `Put "${e.name}" back on the list` : `Mark "${e.name}" as done`, title: done ? "Put back on the list" : "Mark as done (only on this device)" });
	tick.onclick = () => { const ids = doneIds(); if (done) ids.delete(e.id); else ids.add(e.id); saveDone(ids); onTick(); };
	return h("li", { class: "mf-task-item" },
		h("a", { class: "mf-row mf-task", href: e.url },
			h("span", { class: `mf-date ${b === "Overdue" ? "bad" : b === "Today" ? "now" : ""}`.trim() }, h("span", {}, d.toLocaleDateString(undefined, { weekday: "short" })), h("strong", {}, String(d.getDate()))),
			h("span", { class: "mf-row-main" }, h("span", { class: "mf-row-title" }, e.name), h("span", { class: "mf-row-sub" }, [e.course.fullname, KIND[e.modulename ?? ""]].filter(Boolean).join(" · "))),
			h("span", { class: `mf-task-when${b === "Overdue" ? " bad" : ""}` }, h("strong", {}, relative(e.timesort, now)), h("span", {}, later ? `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${time}` : time))),
		tick);
}

/** The page's two columns. Each filter change repaints them; typing only repaints the list so the input keeps focus. */
export function buildAssignments(): { main: HTMLElement[]; side: HTMLElement[] } {
	const st: State = { events: read<{ events: Pending[] }>(KEY, { events: [] }).events, loading: true, failed: false, period: "all", course: "", text: "", showDone: false };
	const body = h("section", { class: "mf-block mf-assign" });
	const side = h("section", { class: "mf-block mf-assign-side" });
	const groups = h("div", { class: "mf-assign-groups" });

	const split = (): { open: Pending[]; done: Pending[] } => {
		const ids = doneIds();
		return { open: st.events.filter((e) => !ids.has(e.id)), done: st.events.filter((e) => ids.has(e.id)) };
	};
	const clearFilters = (): void => { st.period = "all"; st.course = ""; st.text = ""; paint(); };
	const note = (text: string, action?: HTMLElement): HTMLElement => h("p", { class: "mf-empty" }, text, action ? " " : null, action);
	const button = (label: string, fn: () => void, cls = "mf-link"): HTMLElement => { const b = h("button", { type: "button", class: cls }, label); b.onclick = fn; return b; };

	const paintList = (): void => {
		const now = Math.floor(Date.now() / 1000);
		const { open, done } = split();
		const pool = st.showDone ? done : open;
		if (st.loading && !st.events.length) return groups.replaceChildren(h("p", { class: "mf-row-sub" }, "Loading your assignments…"));
		if (st.failed && !st.events.length) return groups.replaceChildren(note("Couldn't load your assignments. Check your connection, or sign in again.", button("Try again", reload)));
		const q = st.text.trim().toLowerCase();
		const list = pool.filter((e) => (!st.course || e.course.fullname === st.course) && (st.showDone || inPeriod(e.timesort, st.period, now)) && (!q || `${e.name} ${e.course.fullname}`.toLowerCase().includes(q)));
		const filtered = st.course || q || (!st.showDone && st.period !== "all");
		const tail: HTMLElement[] = [];
		if (st.failed) tail.push(h("p", { class: "mf-row-sub mf-assign-note" }, "Couldn't reach Moodle just now, so this is the list from your last visit. ", button("Try again", reload)));
		if (st.events.length >= LIMIT) tail.push(h("p", { class: "mf-row-sub mf-assign-note" }, `Showing the first ${LIMIT} items Moodle returned.`));
		if (!st.showDone && done.length) tail.push(h("p", { class: "mf-row-sub mf-assign-note" }, `${done.length} marked as done. `, button("Review", () => { st.showDone = true; paint(); })));
		if (st.showDone) tail.push(h("p", { class: "mf-row-sub mf-assign-note" }, button("← Back to pending", () => { st.showDone = false; paint(); })));
		if (!list.length) return groups.replaceChildren(
			note(st.showDone ? "Nothing marked as done." : filtered ? "Nothing matches these filters." : "All caught up. Nothing is pending.", filtered ? button("Clear filters", clearFilters) : undefined), ...tail);
		groups.replaceChildren(...group(list, now).map((g) => h("div", { class: "mf-assign-group" },
			h("h3", { class: `mf-assign-heading${g.name === "Overdue" && !st.showDone ? " bad" : ""}` }, g.name, h("span", { class: "mf-count" }, String(g.items.length)),
				g.name === "Overdue" && !st.showDone ? button("Mark all done", () => { saveDone([...doneIds(), ...g.items.map((e) => e.id)]); paint(); }, "mf-link mf-assign-bulk") : null),
			h("ul", { class: "mf-rows" }, ...g.items.map((e) => row(e, now, st.showDone, paint))))), ...tail);
	};
	const paint = (): void => {
		const now = Math.floor(Date.now() / 1000);
		const { open } = split();
		const count = (p: Period) => open.filter((e) => inPeriod(e.timesort, p, now)).length;
		const periods: [Period, string][] = [["all", "All"], ["Overdue", "Overdue"], ["Today", "Today"], ["Soon", "This week"], ["Later", "Later"]];
		const seg = h("div", { class: "mf-seg", role: "group", "aria-label": "Show assignments due" }, ...periods.map(([id, name]) => {
			const b = h("button", { type: "button", class: "mf-seg-item", "aria-pressed": String(!st.showDone && st.period === id) }, name, h("span", { class: "mf-seg-n" }, String(count(id))));
			b.onclick = () => { st.period = id; st.showDone = false; paint(); };
			return b;
		}));
		const byCourse = new Map<string, number>();
		for (const e of open) byCourse.set(e.course.fullname, (byCourse.get(e.course.fullname) ?? 0) + 1);
		const courses = [...byCourse].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
		// narrow screens have no sidebar column, so the course filter becomes a menu in the bar
		const pick = h("select", { class: "input mf-course-select", "aria-label": "Course" }, h("option", { value: "" }, "All courses"), ...courses.map(([name, n]) => h("option", { value: name }, `${name} (${n})`)));
		pick.value = st.course;
		pick.onchange = () => { st.course = pick.value; paint(); };
		const search = h("input", { type: "search", class: "input mf-filter", placeholder: "Find an assignment", "aria-label": "Find an assignment", value: st.text });
		search.oninput = () => { st.text = search.value; paintList(); };
		body.replaceChildren(h("div", { class: "mf-block-head mf-assign-bar" }, seg, courses.length > 1 ? pick : null, search), groups);
		paintList();

		const overdue = count("Overdue");
		side.hidden = !courses.length;
		document.querySelector(".content")?.classList.toggle("single-column", !courses.length);
		side.replaceChildren(
			h("div", { class: "mf-block-head" }, h("h3", {}, "By course")),
			h("ul", { class: "mf-rows" }, ...courses.map(([name, n]) => {
				const b = h("button", { type: "button", class: "mf-row mf-course-row", "aria-pressed": String(st.course === name) }, h("span", { class: "mf-row-title" }, name), h("span", { class: "mf-count" }, String(n)));
				b.onclick = () => { st.course = st.course === name ? "" : name; paint(); };
				return h("li", {}, b);
			})),
			...(overdue ? [h("p", { class: "mf-row-sub mf-assign-note" }, `${overdue} overdue. Tick items off once handed in.`)] : []));
	};
	const reload = (): void => {
		st.loading = true;
		paintList();
		void load().then(({ events, ok }) => { st.events = events; st.loading = false; st.failed = !ok; paint(); });
	};
	paint();
	reload();
	return { main: [body], side: [side] };
}
