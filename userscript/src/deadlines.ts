// Dashboard card: what is due soon, from Moodle's own timeline API. Ticking an item off is local (a marker for you, not a
// submission). Cached for 10 minutes so navigating around the site does not re-ask every page.
import * as settings from "./settings";
import { call, read, write, homeSlot } from "./api";
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

async function load(): Promise<DueEvent[]> {
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

const when = (t: number) => new Date(t * 1000).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

let card: HTMLElement | undefined;
async function render(): Promise<void> {
	card?.remove(); card = undefined;
	const slot = settings.get().deadlines ? homeSlot() : null;
	if (!slot) return;
	const events = await load();
	const done = new Set<number>(read<{ ids: number[] }>(DONE, { ids: [] }).ids);
	const open = events.filter((e) => !done.has(e.id));
	if (!open.length || !settings.get().deadlines || card) return;
	const now = Math.floor(Date.now() / 1000);
	const body = h("div", { class: "mf-due-list" });
	for (const b of ORDER) {
		const group = open.filter((e) => bucket(e.timesort, now) === b);
		if (!group.length) continue;
		body.append(h("h5", { class: b === "Overdue" ? "mf-overdue" : "" }, b), ...group.map((e) => {
			const tick = h("button", { type: "button", class: "mf-due-tick", "aria-label": `Mark "${e.name}" as done`, title: "Mark as done (only on this device)" });
			const item = h("li", { class: "mf-due" }, tick,
				h("a", { href: e.url }, h("span", { class: "mf-due-name" }, e.name), h("span", { class: "mf-due-meta" }, [e.course?.fullname, when(e.timesort)].filter(Boolean).join(" · "))));
			tick.onclick = () => { write(DONE, { ids: [...done, e.id].slice(-200) }); void render(); };
			return h("ul", { class: "mf-due-group" }, item);
		}));
	}
	card = h("section", { class: "mf-card mf-deadlines" }, h("h4", {}, "Due soon", h("span", { class: "mf-count" }, String(open.length))), body);
	slot.prepend(card);
}

export function mountDeadlines(): void {
	void render();
	settings.subscribe((_, changed) => { if (changed.includes("deadlines")) void render(); });
}
