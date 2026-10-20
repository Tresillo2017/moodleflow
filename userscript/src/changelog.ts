// bleh's "The bleh Times" (components/news.tsx), fed by our own CHANGELOG.md instead of bleh's changelog.json: a stack of
// paper pieces, the release date as a headline, prev / next release buttons, and the release notes as a list.
// bleh's news.css (vendored) does all the styling; we only produce the same markup.
import log from "../dist/changelog.json";
import { h, type Kid } from "./dom";
import { current } from "./updater";

type Release = { version: string; date: string; type: "major" | "minor"; sections: { title: string; items: string[] }[] };
const releases = log as Release[];
const KEY = "changelog_seen";

/** Pure: `code` and **bold** in a changelog line as nodes (never HTML, so nothing in the notes can inject markup). */
export function inline(text: string): Kid[] {
	const out: Kid[] = [];
	for (const part of text.split(/(`[^`]+`|\*\*[^*]+\*\*)/)) {
		if (!part) continue;
		if (part.startsWith("`")) out.push(h("code", {}, part.slice(1, -1)));
		else if (part.startsWith("**")) out.push(h("strong", {}, part.slice(2, -2)));
		else out.push(part);
	}
	return out;
}
const fmtDate = (d: string) => (d ? new Date(d + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "full" }) : "");

let wrap: HTMLElement | undefined;
function close(): void {
	if (!wrap) return;
	const el = wrap;
	wrap = undefined;
	removeEventListener("keydown", onKey, true);
	el.querySelector(".bleh-modal")?.classList.add("to-remove");
	setTimeout(() => el.remove(), 250);
}
function onKey(e: KeyboardEvent): void { if (e.key === "Escape") { e.preventDefault(); close(); } }

function action(type: "prev" | "next", label: string, onClick: () => void): HTMLButtonElement {
	const b = h("button", { type: "button", class: "btn flex-button news-update-action", "aria-label": label }, type === "prev" ? "← " + label : label + " →");
	b.onclick = onClick;
	return b;
}

export function openChangelog(): void {
	if (!releases.length) return;
	close();
	let i = 0;
	const list = h("div", { class: "changelog-list" });
	const render = (): void => {
		const r = releases[i];
		const older = i < releases.length - 1, newer = i > 0;
		const prev = action("prev", "Older", () => { i++; render(); });
		const next = action("next", "Newer", () => { i--; render(); });
		prev.disabled = !older; next.disabled = !newer;
		list.replaceChildren(
			h("h2", { class: "news-date" }, fmtDate(r.date) || `Version ${r.version}`),
			h("div", { class: "news-update" },
				h("div", { class: "news-update-head" }, prev,
					h("div", { class: "news-update-middle" },
						h("label", { class: "news-update-label" + (r.type === "major" ? " news-update-label-major" : "") }, r.type === "major" ? "Major update" : "Update"),
						h("h3", { class: "news-update-name" }, h("span", { class: "news-update-version" }, r.version + ": "), r.sections.map((s) => s.title).join(" · "))),
					next),
				h("div", { class: "news-update-body markdown-body colourful", "data-changelog-type": r.type },
					...r.sections.flatMap((s) => [h("h5", {}, s.title), h("ul", {}, ...s.items.map((it) => h("li", {}, ...inline(it))))]))));
	};
	render();
	const closeBtn = h("button", { type: "button", class: "btn modal-close-button icon-mask", "aria-label": "Close", "data-type": "close" }, "Close");
	closeBtn.onclick = close;
	const modal = h("div", { class: "bleh-modal", "data-modal-type": "changelog", role: "dialog", "aria-label": "What's new" },
		h("div", { class: "bleh-modal-title" }, h("h4", {}, "What's new")), closeBtn,
		h("div", { class: "bleh-modal-body" }, h("div", { class: "news-pieces" },
			h("div", { class: "news-piece-main" }, h("h1", { class: "news-title" }, "The ", h("i", { class: "news-title-label" }, "moodleflow"), " Times"), list),
			h("div", { class: "news-piece-back" }), h("div", { class: "news-piece-back-2" }))));
	const el = h("div", { class: "bleh-modals has-dialog" }, modal);
	el.addEventListener("mousedown", (e) => { if (e.target === el) close(); });
	document.body.append(el);
	wrap = el;
	addEventListener("keydown", onKey, true);
	try { GM_setValue(KEY, current()); } catch { /* ignore */ }
}

/** After an update, offer the notes once (a toast, never a forced dialog). */
export function mountChangelog(): void {
	document.addEventListener("moodleflow:changelog", openChangelog);
	let seen = "";
	try { seen = GM_getValue(KEY, ""); } catch { /* ignore */ }
	if (seen === current() || !releases.length) { if (!seen) try { GM_setValue(KEY, current()); } catch { /* ignore */ } return; } // first install: nothing to announce
	const open = h("button", { type: "button", class: "btn flex-button" }, "What's new");
	const later = h("button", { type: "button", class: "btn flex-button" }, "Dismiss");
	const el = h("div", { class: "mf-toast", role: "status" }, h("div", { class: "mf-toast-text" }, h("strong", {}, `moodleflow ${current()}`), h("span", {}, "Updated. See what changed?")), open, later);
	const gone = () => { el.classList.add("to-remove"); setTimeout(() => el.remove(), 300); try { GM_setValue(KEY, current()); } catch { /* ignore */ } };
	open.onclick = () => { gone(); openChangelog(); };
	later.onclick = gone;
	document.body.append(el);
}
