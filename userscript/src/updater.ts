// In-app updater: asks the site for the userscript's metadata block (a few hundred bytes), compares @version, and
// offers the install link. GM_xmlhttpRequest is used because the Moodle page's own CSP/CORS would block the request.
// Violentmonkey also polls @updateURL by itself; this just makes updates visible and checkable from the settings page.
import * as settings from "./settings";
import { h } from "./dom";

const BASE = "https://moodleflow.tomasps.workers.dev";
export const INSTALL_URL = `${BASE}/moodleflow.user.js`;
const META_URL = `${BASE}/moodleflow.meta.js`;
const EVERY_MS = 30 * 60e3; // the metadata is a few hundred bytes: checking every half hour is cheap
const NAG_MS = 6 * 3600e3; // "Later" hides the toast for this long (the menu entry stays)
const KEY = "update";
export const current = (): string => (typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0");

export const parseVersion = (meta: string): string | undefined => /^\/\/\s*@version\s+(\S+)/m.exec(meta)?.[1];

/** Pure: is `latest` a higher dotted version than `now`? */
export function isNewer(latest: string, now: string): boolean {
	const a = latest.split(".").map((n) => parseInt(n, 10) || 0), b = now.split(".").map((n) => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
	return false;
}

type Cache = { at: number; latest?: string; dismissed?: string; dismissedAt?: number };
const read = (): Cache => { try { return JSON.parse(GM_getValue(KEY, "{}")); } catch { return { at: 0 }; } };
const write = (c: Cache) => GM_setValue(KEY, JSON.stringify(c));

const fetchMeta = () => new Promise<string>((ok, no) => GM_xmlhttpRequest({
	url: META_URL, timeout: 8000, anonymous: true,
	onload: (r) => (r.status === 200 ? ok(r.responseText) : no(new Error(`HTTP ${r.status}`))),
	onerror: () => no(new Error("network error")), ontimeout: () => no(new Error("timed out")),
}));

export type Result = { latest?: string; newer: boolean; error?: string };
/** Cached for 12h unless `force`. Never throws. */
export async function checkForUpdate(force = false): Promise<Result> {
	const c = read();
	if (!force && c.latest && Date.now() - c.at < EVERY_MS) return { latest: c.latest, newer: isNewer(c.latest, current()) };
	try {
		const latest = parseVersion(await fetchMeta());
		if (!latest) throw new Error("no version in the metadata");
		write({ ...c, at: Date.now(), latest });
		return { latest, newer: isNewer(latest, current()) };
	} catch (e) {
		return { newer: false, error: e instanceof Error ? e.message : "failed" };
	}
}

// ---- the update flow: available → installing (the install tab is open) → ready (reload to apply) ----
type Phase = "available" | "installing" | "ready";
let el: HTMLElement | undefined;
let phase: Phase | undefined;
let installTab: Window | null = null;

const gone = () => { const e = el; el = undefined; e?.classList.add("to-remove"); setTimeout(() => e?.remove(), 300); };
function show(next: Phase, latest: string): void {
	phase = next;
	const buttons: HTMLElement[] = [];
	let title: string, sub: string;
	if (next === "available") {
		title = `moodleflow ${latest} is out`; sub = `You have ${current()}`;
		const update = h("button", { type: "button", class: "btn flex-button" }, "Update");
		update.onclick = () => startUpdate(latest);
		const later = h("button", { type: "button", class: "btn flex-button" }, "Later");
		later.onclick = () => { write({ ...read(), dismissed: latest, dismissedAt: Date.now() }); gone(); };
		buttons.push(update, later);
	} else if (next === "installing") {
		title = "Installing the update…"; sub = "Confirm it in the tab that just opened";
		const done = h("button", { type: "button", class: "btn flex-button" }, "I've installed it");
		done.onclick = () => show("ready", latest);
		buttons.push(done);
	} else {
		title = `moodleflow ${latest} installed`; sub = "Reload the page to start using it";
		const reload = h("button", { type: "button", class: "btn flex-button" }, "Reload now");
		reload.onclick = () => location.reload();
		const later = h("button", { type: "button", class: "btn flex-button" }, "Later");
		later.onclick = gone;
		buttons.push(reload, later);
	}
	const node = h("div", { class: `mf-toast mf-update-toast ${next}`, role: "status" }, next === "installing" ? h("span", { class: "mf-spinner" }) : null, h("div", { class: "mf-toast-text" }, h("strong", {}, title), h("span", {}, sub)), ...buttons);
	el?.remove();
	el = node;
	document.body.append(node);
}

/** Opens the install page (the script manager shows its install / update dialog) and follows it: when that tab closes, or
 *  when the user comes back to this one, the update is most likely in, so offer the reload. */
export function startUpdate(latest = read().latest ?? ""): void {
	installTab = window.open(INSTALL_URL, "_blank"); // no `noopener`: we want `.closed` to know when the dialog is done
	show("installing", latest);
	const finish = () => { if (phase === "installing") show("ready", latest); };
	const poll = setInterval(() => { if (!installTab || installTab.closed) { clearInterval(poll); finish(); } }, 600);
	document.addEventListener("visibilitychange", function back() { if (document.visibilityState === "visible" && phase === "installing") { setTimeout(finish, 1500); document.removeEventListener("visibilitychange", back); } });
}

// ---- the user-menu entry, kept in sync with what we know ----
function syncMenu(latest: string | undefined, newer: boolean): void {
	document.body.toggleAttribute("data-mf-update", newer);
	const toggle = document.getElementById("user-menu-toggle");
	toggle?.querySelector(".mf-update-dot")?.remove();
	if (newer && toggle) toggle.append(h("span", { class: "mf-update-dot", title: "A moodleflow update is available" }));
	document.getElementById("mf-update")?.remove();
	const entry = document.getElementById("mf-entry");
	if (!newer || !latest || !entry) return;
	const a = h("a", { class: "dropdown-item dropdown-menu-clickable-item", href: "#", role: "menuitem", id: "mf-update" }, `Update to v${latest}`);
	a.onclick = (e) => { e.preventDefault(); startUpdate(latest); };
	entry.before(a);
}

export function mountUpdater(): void {
	const run = async (force = false) => {
		if (!settings.get().update_check) { syncMenu(undefined, false); return; }
		const r = await checkForUpdate(force);
		syncMenu(r.latest, r.newer);
		if (!r.newer || !r.latest || phase) return; // nothing new, or the flow is already on screen
		const c = read();
		const snoozed = c.dismissed === r.latest && Date.now() - (c.dismissedAt ?? 0) < NAG_MS;
		if (!snoozed) show("available", r.latest);
	};
	const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(() => void run(), { timeout: 5000 }) : setTimeout(() => void run(), 2000));
	document.readyState === "complete" ? idle() : addEventListener("load", idle, { once: true });
	// keep checking while the tab stays open, and whenever it is brought back to the front
	setInterval(() => void run(), EVERY_MS);
	document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - read().at > EVERY_MS / 2) void run(); });
	settings.subscribe((_, changed) => { if (changed.includes("update_check")) void run(true); });
}
