// Dashboard card: what is due soon, from Moodle's own timeline API. Ticking an item off is local (a marker for you, not a
// submission). Cached for 10 minutes so navigating around the site does not re-ask every page.
import * as settings from "./settings";
import { call, read, write, homeSlot, siteRoot } from "./api";
import { h } from "./dom";

export type DueEvent = { id: number; modulename?: string; name: string; timesort: number; url: string; course?: { fullname?: string } };
export const DONE = "deadlines_done";
export const DAY = 86400;
const KEY = "deadlines", TTL = 60e3; // short: a handed-in assignment should leave the list soon

export const startOfDay = (t: number) => { const d = new Date(t * 1000); d.setHours(0, 0, 0, 0); return d.getTime() / 1000; };
/** Pure: the start of the day `n` calendar days after the day `dayStart` (seconds) begins; correct across DST changes. */
export const addDays = (dayStart: number, n: number): number => { const d = new Date(dayStart * 1000); d.setDate(d.getDate() + n); return d.getTime() / 1000; };
/** Pure: which heading an event belongs under, relative to `now` (seconds). */
export function bucket(timesort: number, now: number): "Overdue" | "Today" | "Tomorrow" | "This week" | "Later" {
	const today = startOfDay(now);
	if (timesort < now) return "Overdue";
	if (timesort < addDays(today, 1)) return "Today";
	if (timesort < addDays(today, 2)) return "Tomorrow";
	return timesort < addDays(today, 7) ? "This week" : "Later";
}
export const ORDER = ["Overdue", "Today", "Tomorrow", "This week", "Later"] as const;

export async function load(): Promise<DueEvent[]> {
	const hit = read<{ at: number; events: DueEvent[] }>(KEY, { at: 0, events: [] });
	if (Date.now() - hit.at < TTL) return hit.events;
	const now = Math.floor(Date.now() / 1000);
	const res = await call<{ events: (DueEvent & { action?: { actionable?: boolean } })[] }>("core_calendar_get_action_events_by_timesort",
		{ timesortfrom: now - 7 * DAY, timesortto: now + 30 * DAY, limitnum: 40 });
	if (!res) return hit.events;
	const events = res.events.filter((e) => e.action?.actionable !== false).map(({ id, name, timesort, url, course }) => ({ id, name, timesort, url, course: { fullname: course?.fullname } }));
	write(KEY, { at: Date.now(), events });
	return events;
}


export function perDay(events: Pick<DueEvent, "timesort">[], from: number, days = 7): number[] {
	const start = startOfDay(from);
	return Array.from({ length: days }, (_, i) => events.filter((e) => e.timesort >= addDays(start, i) && e.timesort < addDays(start, i + 1)).length);
}

// ---- the calendar part is interactive: page through weeks, pick a day to see just its deadlines ----
let weekOffset = 0; // weeks from the current one
let picked: number | null = null; // start of the chosen day (seconds), or null for "what is next"
const ranges = new Map<number, DueEvent[]>(); // other weeks, fetched when you page to them

async function weekEvents(weekStart: number, base: DueEvent[]): Promise<DueEvent[]> {
	const inBase = base.filter((e) => e.timesort >= weekStart && e.timesort < addDays(weekStart, 7));
	const cached = ranges.get(weekStart);
	if (cached) return cached;
	const res = await call<{ events: (DueEvent & { action?: { actionable?: boolean } })[] }>("core_calendar_get_action_events_by_timesort", { timesortfrom: weekStart, timesortto: addDays(weekStart, 7), limitnum: 50 });
	const list = res ? res.events.filter((e) => e.action?.actionable !== false).map(({ id, name, timesort, url, course }) => ({ id, name, timesort, url, course: { fullname: course?.fullname } })) : inBase;
	if (res) ranges.set(weekStart, list);
	return list;
}

let card: HTMLElement | undefined;
let rendering = 0;
async function render(): Promise<void> {
	const mine = ++rendering;
	const slot = settings.get().deadlines ? homeSlot("side") : null;
	if (!slot) { card?.remove(); card = undefined; return; }
	const base = await load();
	const done = new Set<number>(read<{ ids: number[] }>(DONE, { ids: [] }).ids);
	const now = Math.floor(Date.now() / 1000);
	const today = startOfDay(now);
	const weekStart = addDays(today, weekOffset * 7);
	const pool = (weekOffset === 0 ? base : await weekEvents(weekStart, base)).filter((e) => !done.has(e.id));
	if (mine !== rendering) return; // a newer render took over while we were fetching
	const open = base.filter((e) => !done.has(e.id));
	if (!open.length && !settings.get().home && weekOffset === 0) { card?.remove(); card = undefined; return; }
	const shown = picked !== null ? pool.filter((e) => e.timesort >= picked! && e.timesort < addDays(picked!, 1)) : weekOffset === 0 ? open.slice(0, 5) : pool;

	const rows = h("ul", { class: "mf-rows" });
	for (const e of shown) {
		const b = bucket(e.timesort, now);
		const d = new Date(e.timesort * 1000);
		const tick = h("button", { type: "button", class: "mf-due-tick", "aria-label": `Mark "${e.name}" as done`, title: "Mark as done (only on this device)" });
		tick.onclick = () => { write(DONE, { ids: [...done, e.id].slice(-200) }); void render(); };
		rows.append(h("li", { class: "mf-task-item" }, h("a", { class: "mf-row mf-task", href: e.url },
			h("span", { class: `mf-date ${b === "Overdue" ? "bad" : b === "Today" ? "now" : ""}`.trim() }, h("span", {}, d.toLocaleDateString(undefined, { weekday: "short" })), h("strong", {}, String(d.getDate()))),
			h("span", { class: "mf-row-main" }, h("span", { class: "mf-row-title" }, e.name), h("span", { class: "mf-row-sub" }, [b === "Overdue" ? "Overdue" : null, e.course?.fullname, d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · ")))), tick));
	}
	if (!shown.length) rows.append(h("li", { class: "mf-row-empty" }, picked !== null ? "Nothing due that day." : weekOffset ? "Nothing due that week." : "Nothing due. Enjoy the week."));

	const nav = (label: string, text: string, fn: () => void) => { const b = h("button", { type: "button", class: "mf-cal-nav", "aria-label": label, title: label }, text); b.onclick = fn; return b; };
	const first = new Date(weekStart * 1000 + 12 * 3600e3), last = new Date(addDays(weekStart, 6) * 1000 + 12 * 3600e3);
	const range = `${first.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${last.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
	const counts = perDay(pool, weekStart);
	const strip = h("div", { class: "mf-week", role: "group", "aria-label": "Deadlines by day" }, ...counts.map((n, i) => {
		const ts = addDays(weekStart, i);
		const d = new Date(ts * 1000 + 12 * 3600e3);
		const day = h("button", { type: "button", class: "mf-day" + (ts === today ? " today" : "") + (n ? " busy" : "") + (picked === ts ? " picked" : ""), "aria-pressed": String(picked === ts), title: n ? pool.filter((e) => e.timesort >= ts && e.timesort < addDays(ts, 1)).map((e) => e.name).join("\n") : "Nothing due" },
			h("span", { class: "mf-day-name" }, d.toLocaleDateString(undefined, { weekday: "short" })), h("span", { class: "mf-day-num" }, String(d.getDate())), h("span", { class: "mf-dots" }, "•".repeat(Math.min(3, n))));
		day.onclick = () => { picked = picked === ts ? null : ts; void render(); };
		return day;
	}));
	const next = h("section", { class: "mf-block mf-deadlines", "data-i": "", style: "--i:3" },
		h("div", { class: "mf-block-head" },
			h("h3", {}, "Due soon"),
			h("a", { class: "mf-more", href: "#moodleflow/assignments" }, open.length > shown.length ? `View all ${open.length}` : "View all"),
			weekOffset || picked !== null ? nav("Back to today", "Today", () => { weekOffset = 0; picked = null; void render(); }) : null,
			nav("Previous week", "‹", () => { weekOffset--; picked = null; void render(); }), nav("Next week", "›", () => { weekOffset++; picked = null; void render(); })),
		h("div", { class: "mf-week-range" }, range), strip, rows);
	if (card?.isConnected) { card.replaceWith(next); card = next; card.classList.add("mf-static"); }
	else { slot.prepend(next); card = next; }
}

export function mountDeadlines(): void {
	void render();
	settings.subscribe((_, changed) => { if (changed.includes("deadlines")) void render(); });
}
