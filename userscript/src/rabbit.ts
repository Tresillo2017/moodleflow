// bleh's quick switcher (components/dialog/rabbit.tsx), trimmed to what Moodle has to search: navigation, tabs, account
// links, courses you've seen, and settings pages. Same modal + `.rabbit-hole-item` markup, so bleh's rabbit.css styles it.
import * as settings from "./settings";
import * as m from "./moodle";
import { h } from "./dom";
import { knownCourses } from "./backdrop";
import { TABS } from "./settings-page";
import { courseSections } from "./coursenav";

type Item = { text: string; href: string; type: string; hay: string };

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Pure: subsequence-friendly scoring; startsWith > word start > includes > scattered letters. */
export function score(query: string, hay: string): number {
	const q = fold(query), t = fold(hay);
	if (!q) return 1;
	if (t.startsWith(q)) return 100 - t.length / 100;
	if (t.includes(" " + q)) return 80 - t.length / 100;
	if (t.includes(q)) return 60 - t.length / 100;
	let i = 0;
	for (const ch of t) if (ch === q[i] && ++i === q.length) return 20;
	return 0;
}

function items(): Item[] {
	const out: Item[] = [];
	const add = (text: string, href: string, type: string) => { if (text && href) out.push({ text, href, type, hay: text }); };
	m.primaryLinks().forEach((l) => add(l.label, l.href, "link"));
	m.secondaryLinks().forEach((l) => add(l.label, l.href, "link"));
	document.querySelectorAll<HTMLAnchorElement>(".usermenu a.dropdown-item[href]").forEach((a) => add(a.textContent!.trim(), a.href, "profile"));
	knownCourses().forEach((c) => add(c.title, c.url, "album"));
	courseSections().forEach((c) => add(c.name, c.href, "link"));
	document.querySelectorAll<HTMLAnchorElement>(".course-content a.aalink[href]").forEach((a) => add(a.querySelector(".instancename")?.firstChild?.textContent?.trim() || a.textContent!.trim(), a.href, "link"));
	TABS.forEach((t) => add(`Settings: ${t.name}`, `#moodleflow/${t.id}`, "settings"));
	const seen = new Set<string>();
	return out.filter((i) => !seen.has(i.href + i.text) && !!seen.add(i.href + i.text));
}

let open: HTMLElement | undefined;

export function closeRabbit(): void {
	if (!open) return;
	const el = open;
	open = undefined;
	el.querySelector(".bleh-modal")?.classList.add("to-remove");
	setTimeout(() => el.remove(), 300);
	removeEventListener("keydown", onKey, true);
}

function onKey(e: KeyboardEvent): void { if (e.key === "Escape") { e.preventDefault(); closeRabbit(); } }

export function openRabbit(): void {
	if (open || !document.body) return;
	const all = items();
	let selected = 0, matches = all.slice(0, 8);
	const input = h("input", { type: "text", class: "rabbit-search", placeholder: "Jump to…", "aria-label": "Quick switcher", autocomplete: "off" });
	const hole = h("div", { class: "rabbit-hole", role: "listbox" });
	const go = (i: Item) => { closeRabbit(); if (i.href.startsWith("#")) location.hash = i.href; else location.assign(i.href); };
	const render = () => {
		hole.replaceChildren(...(matches.length ? matches.map((it, idx) => {
			const b = h("button", { type: "button", class: "dropdown-menu-clickable-item rabbit-hole-item", "data-type": it.type, role: "option", "aria-selected": String(idx === selected) }, h("div", { class: "info" }, h("div", { class: "text" }, it.text)));
			b.onclick = () => go(it);
			b.onmouseenter = () => { selected = idx; hole.querySelectorAll("[aria-selected]").forEach((x, j) => x.setAttribute("aria-selected", String(j === selected))); };
			return b;
		}) : [h("div", { class: "placeholder-block" }, h("div", { class: "placeholder-head" }, "₍ᐢ. .ᐢ₎"), h("div", { class: "placeholder-summary" }, "Nothing matches that."))]));
		hole.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
	};
	input.oninput = () => {
		matches = all.map((it) => ({ it, s: score(input.value, it.hay) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8).map((x) => x.it);
		selected = 0;
		render();
	};
	input.onkeydown = (e) => {
		if (e.key === "ArrowDown") { e.preventDefault(); selected = Math.min(selected + 1, matches.length - 1); render(); }
		else if (e.key === "ArrowUp") { e.preventDefault(); selected = Math.max(selected - 1, 0); render(); }
		else if (e.key === "Enter" && matches[selected]) { e.preventDefault(); go(matches[selected]); }
	};
	const modal = h("div", { class: "bleh-modal", "data-modal-type": "rabbit", role: "dialog", "aria-label": "Quick switcher" },
		h("div", { class: "bleh-modal-body" }, input, hole, h("div", { class: "tip" }, h("div", { class: "left" }, h("kbd", {}, "Esc"), " Close"), h("div", { class: "right" }, "Courses you've visited appear here"))));
	const wrap = h("div", { class: "bleh-modals has-dialog" }, modal);
	wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) closeRabbit(); });
	document.body.append(wrap);
	open = wrap;
	addEventListener("keydown", onKey, true);
	render();
	input.focus();
}

export function mountRabbit(): void {
	addEventListener("keydown", (e) => {
		if (!settings.get().rabbit || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k" || e.shiftKey || e.altKey) return;
		e.preventDefault();
		open ? closeRabbit() : openRabbit();
	});
	// "/" opens it too, unless you are typing somewhere
	addEventListener("keydown", (e) => {
		if (e.key !== "/" || !settings.get().rabbit || !settings.get().shortcuts || e.ctrlKey || e.metaKey || e.altKey || open) return;
		if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
		e.preventDefault();
		openRabbit();
	});
}
