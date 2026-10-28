// Opens activities (assignments, forums, pages, books …) in a popout over the course instead of navigating away, so
// closing it puts you right back where you were. The popout is an iframe of the real page: submissions, forms and
// scripts all keep working, and the script runs inside it in "frame mode" (no masthead / sidebar, see main.ts).
// Quizzes, lessons and SCORM are left alone (timed / secure / full-screen); Ctrl/⌘/Shift-click opens normally.
import * as settings from "./settings";
import { h } from "./dom";

export const FRAME_NAME = "mf-popout";
const MODS = "assign|forum|page|book|folder|choice|feedback|data|glossary|workshop|wiki|h5pactivity|label|survey|chat|bigbluebuttonbn";
const ACTIVITY = new RegExp(`/mod/(${MODS})/view\\.php$`);

/** Pure: does this url open as an activity popout? */
export function isActivityLink(url: URL, origin: string): boolean {
	return url.origin === origin && ACTIVITY.test(url.pathname) && url.searchParams.has("id");
}

let wrap: HTMLElement | undefined;
let dirty = false; // the form inside has been touched (typed, picked or uploaded a file)
const DIALOG = ".modal.show, .moodle-dialogue-base:not(.moodle-dialogue-hidden), .filepicker, .mf-preview-open";
function close(force = false): void {
	if (!wrap) return;
	if (!force && dirty && !confirm("Close without saving? What you entered here will be lost.")) return;
	dirty = false;
	const el = wrap;
	wrap = undefined;
	removeEventListener("keydown", onKey, true);
	el.querySelector(".bleh-modal")?.classList.add("to-remove");
	setTimeout(() => el.remove(), 250);
}
function onKey(e: KeyboardEvent): void { if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector(".bleh-modals.has-dialog[data-mf-top]")) { e.preventDefault(); close(); } }

function open(href: string, name: string): void {
	close();
	const frame = h("iframe", { name: FRAME_NAME, title: name, src: href, class: "mf-popout-frame" });
	const title = h("h4", {}, name);
	const tab = h("a", { class: "btn flex-button", target: "_blank", rel: "noopener", href }, "Open in tab");
	const closeBtn = h("button", { type: "button", class: "btn modal-close-button icon-mask", "aria-label": "Close", "data-type": "close" }, "Close");
	closeBtn.onclick = () => close();
	const loading = h("div", { class: "mf-popout-loading" }, h("span", { class: "mf-spinner" }));
	const modal = h("div", { class: "bleh-modal", "data-modal-type": "activity", role: "dialog", "aria-label": name },
		h("div", { class: "bleh-modal-title" }, h("div", {}, title)), closeBtn,
		h("div", { class: "bleh-modal-body" }, loading, frame),
		h("div", { class: "mf-preview-bar" }, h("span", { class: "mf-spacer" }), tab));
	const el = h("div", { class: "bleh-modals has-dialog" }, modal);
	el.addEventListener("mousedown", (e) => { if (e.target === el && !dirty) close(); }); // a stray click must not throw away a half-done submission
	document.body.append(el);
	wrap = el;
	addEventListener("keydown", onKey, true);
	frame.addEventListener("load", () => {
		loading.remove();
		try { // same origin, so we can follow the frame as it navigates
			const doc = frame.contentDocument!;
			const t = doc.querySelector("h1")?.textContent?.trim() || doc.title.split("|")[0].trim();
			if (t) title.textContent = t;
			tab.href = frame.contentWindow!.location.href;
			dirty = false; // new page in the frame (including after a save)
			doc.addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.defaultPrevented && !doc.querySelector(DIALOG) && !(e.target as Element).closest?.("input, textarea, select, [contenteditable]")) close(); });
			doc.addEventListener("input", () => { dirty = true; });
			doc.addEventListener("change", () => { dirty = true; });
			// the file picker adds files without a change event on the form; a drop that misses the drop zone must not navigate the frame to the file
			doc.addEventListener("click", (e) => { if ((e.target as Element).closest?.(".fp-upload-btn, .fp-select-confirm, .fp-dlg-butconfirm, .fp-file")) dirty = true; });
			for (const t of ["dragover", "drop"]) doc.addEventListener(t, (e) => { if (!e.defaultPrevented) e.preventDefault(); });
			frame.contentWindow!.addEventListener("beforeunload", () => { dirty = false; }); // submitting the form is not abandoning it
		} catch { /* left the site: keep the original title */ }
	});
}

/** The frame tells us when something happened in it that the whole page should celebrate. */
export function mountPopout(): void {
	document.addEventListener("click", (e) => {
		if (!settings.get().activity_popup || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
		const a = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
		if (!a || a.target === "_blank" || a.hasAttribute("download") || a.closest(".masthead, .bleh-modals, [data-mf-settings], .navlist, .breadcrumb")) return;
		let url: URL;
		try { url = new URL(a.href); } catch { return; }
		if (!isActivityLink(url, location.origin) || url.pathname === location.pathname && url.search === location.search) return;
		e.preventDefault();
		open(a.href, a.querySelector(".instancename")?.firstChild?.textContent?.trim() || a.textContent?.replace(/\s+/g, " ").trim() || "Activity");
	}, true);
}
