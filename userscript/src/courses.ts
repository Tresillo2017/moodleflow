// Course card tools on the dashboard / "My courses": pin to the top, hide, and give a course a short name of your own.
// All local to this browser; Moodle's own nodes are only restyled (hidden with an attribute, reordered with css `order`).
import * as settings from "./settings";
import { read, write } from "./api";
import { CARD, cardCourseId } from "./backdrop";
import { onDomChange } from "./watch";
import { h } from "./dom";

type Prefs = { pins: string[]; hidden: string[]; alias: Record<string, string> };
const KEY = "course_prefs";
const prefs = (): Prefs => read<Prefs>(KEY, { pins: [], hidden: [], alias: {} });
const save = (p: Prefs) => { write(KEY, p); apply(); };
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** The element that sits in the card grid: the card, or its wrapper when the card is the wrapper's only child. */
function slotOf(card: HTMLElement): HTMLElement {
	let el = card;
	while (el.parentElement && el.parentElement.children.length === 1 && !/^(MAIN|SECTION)$/.test(el.parentElement.tagName) && !el.parentElement.id) el = el.parentElement;
	return el;
}
const titleEl = (card: HTMLElement) => card.querySelector<HTMLElement>(".multiline, .coursename, h2, h3");

function decorate(card: HTMLElement): void {
	const id = cardCourseId(card);
	if (!id || card.querySelector(":scope > .mf-card-tools")) return;
	const btn = (label: string, text: string, fn: () => void) => { const b = h("button", { type: "button", "aria-label": label, title: label }, text); b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fn(); }; return b; };
	card.append(h("div", { class: "mf-card-tools" },
		btn("Pin to top", "★", () => { const p = prefs(); save({ ...p, pins: toggle(p.pins, id) }); }),
		btn("Rename", "✎", () => {
			const p = prefs(), name = prompt("Short name for this course (empty to restore)", p.alias[id] ?? titleEl(card)?.dataset.mfOrig ?? titleEl(card)?.textContent?.trim() ?? "");
			if (name === null) return;
			const alias = { ...p.alias }; name.trim() ? (alias[id] = name.trim().slice(0, 80)) : delete alias[id];
			save({ ...p, alias });
		}),
		btn("Hide course", "✕", () => { const p = prefs(); save({ ...p, hidden: toggle(p.hidden, id) }); })));
}

let showHidden = false;
let bar: HTMLElement | undefined;
function apply(): void {
	const p = prefs(), on = settings.get().course_tools;
	const cards = [...document.querySelectorAll<HTMLElement>(CARD)];
	let hiddenCount = 0;
	for (const card of cards) {
		const id = cardCourseId(card), slot = slotOf(card), t = titleEl(card);
		if (!on || !id) { slot.removeAttribute("data-mf-hidden"); slot.style.order = ""; card.classList.remove("mf-pinned"); card.querySelector(":scope > .mf-card-tools")?.remove(); if (t?.dataset.mfOrig) { t.textContent = t.dataset.mfOrig; delete t.dataset.mfOrig; } continue; }
		decorate(card);
		const hide = p.hidden.includes(id);
		hiddenCount += hide ? 1 : 0;
		slot.toggleAttribute("data-mf-hidden", hide);
		slot.style.order = p.pins.includes(id) ? "-1" : "";
		card.classList.toggle("mf-pinned", p.pins.includes(id));
		if (t) {
			if (p.alias[id]) { t.dataset.mfOrig ??= t.textContent ?? ""; if (t.textContent !== p.alias[id]) t.textContent = p.alias[id]; }
			else if (t.dataset.mfOrig) { t.textContent = t.dataset.mfOrig; delete t.dataset.mfOrig; }
		}
	}
	document.body.toggleAttribute("data-mf-show-hidden", showHidden);
	bar?.remove(); bar = undefined;
	if (on && hiddenCount && cards[0]) {
		const b = h("button", { type: "button", class: "btn flex-button" }, showHidden ? `Hide ${hiddenCount} hidden courses` : `Show ${hiddenCount} hidden courses`);
		b.onclick = () => { showHidden = !showHidden; apply(); };
		bar = h("div", { class: "mf-hidden-bar" }, b);
		slotOf(cards[0]).parentElement?.before(bar);
	}
}

export function mountCourseTools(): void {
	let t = 0;
	onDomChange(() => { clearTimeout(t); t = window.setTimeout(apply, 120); }); // cards arrive over AJAX
	settings.subscribe((_, c) => { if (c.includes("course_tools")) apply(); });
}
