// Dashboard card: what is due soon, from Moodle's own timeline API. Ticking an item off is local (a marker for you, not a
// submission). Cached for 10 minutes so navigating around the site does not re-ask every page.
import * as settings from "./settings";
import { call, read, write, homeSlot, siteRoot } from "./api";
import { h } from "./dom";

export type DueEvent = { id: number; name: string; timesort: number; url: string; course?: { fullname?: string } };
const KEY = "deadlines", DONE = "deadlines_done", TTL = 10 * 60e3, DAY = 86400;

const startOfDay = (t: number) => { const d = new Date(t * 1000); d.setHours(0, 0, 0, 0); return d.getTime() / 1000; };
/** Pure: which heading an event belongs under, relative to `now` (seconds). */
export function bucket(timesort: number, now: number): "Overdue" | "Today" | "Tomorrow" | "This week" | "Later" {
	const today = startOfDay(now);
	if (timesort < now) return "Overdue";
	if (timesort < today + DAY) return "Today";
	if (timesort < today + 2 * DAY) return "Tomorrow";
	return timesort < today + 7 * DAY ? "This week" : "Later";
}
const ORDER = ["Overdue", "Today", "Tomorrow", "This week", "Later"] as const;

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


/** Pure: how many events fall on each of the next `days` days starting at the day of `now` (index 0 = today). */
export function perDay(events: Pick<DueEvent, "timesort">[], now: number, days = 7): number[] {
	const start = startOfDay(now);
	return Array.from({ length: days }, (_, i) => events.filter((e) => e.timesort >= start + i * DAY && e.timesort < start + (i + 1) * DAY).length);
}
/** Seven day cells, today first, each with the weekday, the date and a dot per deadline (capped at three). */
function weekStrip(events: DueEvent[], now: number): HTMLElement {
	const counts = perDay(events, now);
	return h("div", { class: "mf-week" }, ...counts.map((n, i) => {
		const d = new Date((startOfDay(now) + i * DAY) * 1000 + 12 * 3600e3);
		const ts = startOfDay(now) + i * DAY;
		const names = events.filter((e) => e.timesort >= ts && e.timesort < ts + DAY).map((e) => e.name).join("\n");
		return h("a", { class: "mf-day" + (i === 0 ? " today" : "") + (n ? " busy" : ""), href: `${siteRoot()}/calendar/view.php?view=day&time=${ts}`, title: n ? names : "Nothing due" },
			h("span", { class: "mf-day-name" }, d.toLocaleDateString(undefined, { weekday: "short" })),
			h("span", { class: "mf-day-num" }, String(d.getDate())),
			h("span", { class: "mf-dots" }, "•".repeat(Math.min(3, n))));
	}));
}

let card: HTMLElement | undefined;
async function render(): Promise<void> {
	card?.remove(); card = undefined;
	const slot = settings.get().deadlines ? homeSlot("side") : null;
	if (!slot) return;
	const events = await load();
	const done = new Set<number>(read<{ ids: number[] }>(DONE, { ids: [] }).ids);
	const open = events.filter((e) => !done.has(e.id));
	if ((!open.length && !settings.get().home) || !settings.get().deadlines || card) return;
	const now = Math.floor(Date.now() / 1000);
	const rows = h("ul", { class: "mf-rows" });
	for (const e of open.slice(0, 8)) {
		const b = bucket(e.timesort, now);
		const d = new Date(e.timesort * 1000);
		const tick = h("button", { type: "button", class: "mf-due-tick", "aria-label": `Mark "${e.name}" as done`, title: "Mark as done (only on this device)" });
		tick.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); write(DONE, { ids: [...done, e.id].slice(-200) }); void render(); };
		rows.append(h("li", {}, h("a", { class: "mf-row", href: e.url },
			h("span", { class: `mf-date ${b === "Overdue" ? "bad" : b === "Today" ? "now" : ""}`.trim() }, h("span", {}, d.toLocaleDateString(undefined, { weekday: "short" })), h("strong", {}, String(d.getDate()))),
			h("span", { class: "mf-row-main" }, h("span", { class: "mf-row-title" }, e.name), h("span", { class: "mf-row-sub" }, [b === "Overdue" ? "Overdue" : null, e.course?.fullname, d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · "))), tick)));
	}
	if (!open.length) rows.append(h("li", { class: "mf-row-empty" }, "Nothing due. Enjoy the week."));
	card = h("section", { class: "mf-block mf-deadlines", "data-i": "", style: "--i:3" },
		h("div", { class: "mf-block-head" }, h("h3", {}, "Due soon", open.length ? h("span", { class: "mf-count" }, String(open.length)) : null), h("a", { class: "mf-more", href: `${siteRoot()}/calendar/view.php?view=upcoming` }, "Calendar")),
		weekStrip(open, now), rows);
	slot.prepend(card);
}

export function mountDeadlines(): void {
	void render();
	settings.subscribe((_, changed) => { if (changed.includes("deadlines")) void render(); });
}
