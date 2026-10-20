// "Continue where you left off": remembers the last few course pages / activities you opened (shown as a card on the
// dashboard) and restores the scroll position when you come back to the same page.
import * as settings from "./settings";
import * as m from "./moodle";
import { read, write, homeSlot } from "./api";
import { knownCourses } from "./backdrop";
import { h } from "./dom";

export type Visit = { url: string; title: string; sub: string; at: number };
const KEY = "resume", SCROLL = "scroll", KEEP = 5, MAX_SCROLL = 40;
const PAGE = /\/(course\/(view|section)\.php|mod\/[a-z_]+\/(view|index)\.php)$/;

/** Pure: puts `v` first, dropping any older entry for the same url, capped at `keep`. */
export const pushVisit = (list: Visit[], v: Visit, keep = KEEP): Visit[] => [v, ...list.filter((x) => x.url !== v.url)].slice(0, keep);

const pageKey = () => location.pathname + location.search;
const isTracked = () => PAGE.test(location.pathname) && m.isLoggedIn();

function record(): void {
	if (!isTracked()) return;
	const id = m.courseId();
	const course = (id && knownCourses().find((c) => c.url.includes(`id=${id}`))?.title) || m.pageLabel();
	const title = m.pageTitle();
	if (!title) return;
	const list = read<{ items: Visit[] }>(KEY, { items: [] }).items;
	write(KEY, { items: pushVisit(list, { url: location.href, title, sub: course === title ? "" : course, at: Date.now() }) });
}

function restoreScroll(): void {
	if (!isTracked() || location.hash) return;
	const y = read<Record<string, number>>(SCROLL, {})[pageKey()];
	if (y && y > 200) setTimeout(() => scrollTo({ top: y }), 350); // after Moodle's own layout work
	let t = 0;
	addEventListener("scroll", () => {
		clearTimeout(t);
		t = window.setTimeout(() => {
			const all = read<Record<string, number>>(SCROLL, {});
			delete all[pageKey()]; // re-insert last so the oldest keys fall off first
			if (scrollY > 200) all[pageKey()] = Math.round(scrollY);
			write(SCROLL, Object.fromEntries(Object.entries(all).slice(-MAX_SCROLL)));
		}, 400);
	}, { passive: true });
}

function renderCard(): void {
	document.querySelector(".mf-resume")?.remove();
	const slot = settings.get().resume ? homeSlot() : null;
	const items = read<{ items: Visit[] }>(KEY, { items: [] }).items;
	if (!slot || !items.length) return;
	const [last, ...rest] = items;
	slot.prepend(h("section", { class: "mf-card mf-resume" }, h("h4", {}, "Continue"),
		h("a", { class: "mf-resume-main", href: last.url }, h("span", { class: "mf-due-name" }, last.title), h("span", { class: "mf-due-meta" }, last.sub || "Where you stopped")),
		rest.length ? h("ul", { class: "mf-resume-more" }, ...rest.map((v) => h("li", {}, h("a", { href: v.url }, v.title, v.sub ? h("span", { class: "mf-due-meta" }, ` · ${v.sub}`) : null)))) : null));
}

export function mountResume(): void {
	renderCard();
	if (!settings.get().resume) { settings.subscribe((_, c) => { if (c.includes("resume")) { record(); renderCard(); } }); return; }
	record();
	restoreScroll();
	settings.subscribe((_, c) => { if (c.includes("resume")) renderCard(); });
}
