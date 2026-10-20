// "New" markers: the first time you open a course everything in it counts as seen; after that, activities that appear
// are flagged until you open them (or press "Mark all read"). Dashboard cards show the count for courses you have visited.
import * as settings from "./settings";
import * as m from "./moodle";
import { read, write } from "./api";
import { CARD, cardCourseId } from "./backdrop";
import { onDomChange } from "./watch";
import { h } from "./dom";

type Seen = Record<string, { ids: number[]; fresh: number }>; // per course: acknowledged cmids, and how many were new at the last visit
const KEY = "seen";
const store = (): Seen => read<Seen>(KEY, {});

/** Pure: ids present on the page that the user has not acknowledged yet (a course with no record yet has none). */
export const unseen = (seen: number[] | undefined, onPage: number[]): number[] => (seen ? onPage.filter((id) => !seen.includes(id)) : []);

const cmid = (li: Element) => +(li.getAttribute("data-id") ?? li.id.replace(/^module-/, "")) || 0;
const activities = () => [...document.querySelectorAll<HTMLElement>(".course-content li.activity")].map((li) => ({ li, id: cmid(li) })).filter((a) => a.id);
let chip: HTMLElement | undefined;

function markCourse(): void {
	const course = m.courseId();
	const acts = activities();
	if (!course || !acts.length || !settings.get().unread) return;
	const all = store();
	const rec = all[course];
	const fresh = new Set(unseen(rec?.ids, acts.map((a) => a.id)));
	if (!rec) all[course] = { ids: acts.map((a) => a.id), fresh: 0 }; // first visit: baseline
	else all[course] = { ...rec, fresh: fresh.size };
	write(KEY, all);
	for (const a of acts) a.li.toggleAttribute("data-mf-new", fresh.has(a.id));
	chip?.remove(); chip = undefined;
	const side = document.querySelector(".mf-coursenav");
	if (side && fresh.size) {
		const b = h("button", { type: "button", class: "btn flex-button chibi" }, `${fresh.size} new · Mark read`);
		b.onclick = () => { const s = store(); s[course] = { ids: acts.map((x) => x.id), fresh: 0 }; write(KEY, s); markCourse(); };
		chip = h("div", { class: "mf-new-chip" }, b);
		side.querySelector("h4")?.after(chip);
	}
}

function markCards(): void {
	const all = store();
	for (const card of document.querySelectorAll<HTMLElement>(CARD)) {
		const n = settings.get().unread ? (all[cardCourseId(card) ?? ""]?.fresh ?? 0) : 0;
		card.querySelector(".mf-new-dot")?.remove();
		if (n) card.append(h("span", { class: "mf-new-dot", title: `${n} new in this course` }, String(n)));
	}
}

export function mountUnread(): void {
	// opening an activity acknowledges it
	document.addEventListener("click", (e) => {
		const li = (e.target as Element).closest?.<HTMLElement>("li.activity[data-mf-new]");
		if (!li || !(e.target as Element).closest("a[href]")) return;
		const course = m.courseId();
		if (!course) return;
		const s = store();
		if (s[course]) { s[course].ids.push(cmid(li)); s[course].fresh = Math.max(0, s[course].fresh - 1); write(KEY, s); li.removeAttribute("data-mf-new"); }
	}, true);
	let t = 0;
	const run = () => { markCourse(); markCards(); };
	onDomChange(() => { clearTimeout(t); t = window.setTimeout(run, 150); });
	settings.subscribe((_, c) => { if (c.includes("unread")) { run(); if (!settings.get().unread) document.querySelectorAll("[data-mf-new]").forEach((n) => n.removeAttribute("data-mf-new")); } });
}
