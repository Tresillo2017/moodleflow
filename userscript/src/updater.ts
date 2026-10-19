// In-app updater: asks the site for the userscript's metadata block (a few hundred bytes), compares @version, and
// offers the install link. GM_xmlhttpRequest is used because the Moodle page's own CSP/CORS would block the request.
// Violentmonkey also polls @updateURL by itself; this just makes updates visible and checkable from the settings page.
import * as settings from "./settings";
import { h } from "./dom";

const BASE = "https://moodleflow.tomasps.workers.dev";
export const INSTALL_URL = `${BASE}/moodleflow.user.js`;
const META_URL = `${BASE}/moodleflow.meta.js`;
const EVERY_MS = 12 * 3600e3;
const KEY = "update";
export const current = (): string => (typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0");

export const parseVersion = (meta: string): string | undefined => /^\/\/\s*@version\s+(\S+)/m.exec(meta)?.[1];

/** Pure: is `latest` a higher dotted version than `now`? */
export function isNewer(latest: string, now: string): boolean {
	const a = latest.split(".").map((n) => parseInt(n, 10) || 0), b = now.split(".").map((n) => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
	return false;
}

type Cache = { at: number; latest?: string; dismissed?: string };
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

function toast(latest: string): void {
	if (document.querySelector(".mf-toast")) return;
	const close = () => { el.classList.add("to-remove"); setTimeout(() => el.remove(), 300); };
	const update = h("a", { class: "btn flex-button", href: INSTALL_URL, target: "_blank", rel: "noopener" }, "Update");
	update.onclick = close;
	const later = h("button", { type: "button", class: "btn flex-button" }, "Later");
	later.onclick = () => { write({ ...read(), dismissed: latest }); close(); };
	const el = h("div", { class: "mf-toast", role: "status" }, h("div", { class: "mf-toast-text" }, h("strong", {}, `moodleflow ${latest} is out`), h("span", {}, `You have ${current()}`)), update, later);
	document.body.append(el);
}

export function mountUpdater(): void {
	const run = async () => {
		if (!settings.get().update_check) return;
		const r = await checkForUpdate();
		if (r.newer && r.latest && read().dismissed !== r.latest) toast(r.latest);
	};
	const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(() => void run(), { timeout: 5000 }) : setTimeout(() => void run(), 2000));
	document.readyState === "complete" ? idle() : addEventListener("load", idle, { once: true });
	settings.subscribe((_, changed) => { if (changed.includes("update_check")) void run(); });
}
