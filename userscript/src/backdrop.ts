// bleh's blurred page background + "album colour" accent (components/page/colour.ts, page.ts register_background),
// fed with Moodle imagery: profile photo on profiles, course image on course pages.
import * as m from "./moodle";
import * as settings from "./settings";
import { onDomChange } from "./watch";

const COURSE_CACHE = "courseImages";
const TITLES_KEY = "courseTitles";
export type KnownCourse = { title: string; url: string };
let titles: Record<string, KnownCourse> = {};
/** Courses seen on list pages, for the quick switcher. */
export const knownCourses = (): KnownCourse[] => Object.values(titles);
export const CARD = ".course-card, .dashboard-card, .classroom-course-item, .coursebox, .ac-course-card, [data-course-id]";

export const cssUrl = (bg: string | null | undefined): string | null =>
	bg?.match(/url\(\s*["']?([^"')]+)["']?\s*\)/)?.[1] ?? null;

/** Ports bleh's rgb_to_oklch: returns {l,s,h} on the scales its clamp helpers expect. */
export function rgbToOklch(r: number, g: number, b: number): { l: number; s: number; h: number } {
	const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
	const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
	const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
	const mm = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
	const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
	const L = 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s;
	const a = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s;
	const bb = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
	const c = Math.hypot(a, bb);
	const h = c < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
	return { l: L * 100 * 0.92 - 21, s: Math.min(c / 0.4, 1) * 158, h: Math.round(h) };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** bleh's header_colour(): hue/sat/lit for the page accent from an average colour. */
export function accentFromRgb(r: number, g: number, b: number): { hue: number; sat: number; lit: number } {
	const o = rgbToOklch(r, g, b);
	const sat = Math.min(round2((o.s / 100) * 3), 4);
	const lit = round2(Math.max(o.l / 100 + 0.35, 0.7));
	return { hue: o.h, sat, lit };
}

let cache: Record<string, string> = {};
const inflight = new Map<string, Promise<string | null>>();
let seq = 0; // generation token: only the latest refresh may touch the page
// blurred backdrops + their accent colour, so revisiting a course paints at once with no image decode or network wait
const BACKDROP_KEY = "backdropCache", BACKDROP_MAX = 24;
type Cached = { d: string; rgb: [number, number, number] | null; t: number };
let backdrops: Record<string, Cached> = {};
const remember = (url: string, d: string, rgb: Cached["rgb"]) => {
	backdrops[url] = { d, rgb, t: Date.now() };
	const keys = Object.keys(backdrops);
	if (keys.length > BACKDROP_MAX) for (const k of keys.sort((a, b) => backdrops[a].t - backdrops[b].t).slice(0, keys.length - BACKDROP_MAX)) delete backdrops[k];
	try { GM_setValue(BACKDROP_KEY, JSON.stringify(backdrops)); } catch { /* storage full: stay uncached */ }
};
let host: HTMLElement | undefined;
let banner: HTMLElement | undefined; // bleh's .page-banner: the crisp image behind the header
let shownUrl: string | null | undefined;

/** CORS-clean first (so the canvas can be read back), plain load as the fallback for cross-origin images. */
const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, fail) => {
	const attempt = (cors: boolean) => {
		const img = new Image();
		if (cors) img.crossOrigin = "anonymous";
		img.onload = () => ok(img);
		img.onerror = () => (cors ? attempt(false) : fail(new Error("image failed")));
		img.src = src;
	};
	attempt(true);
});

/** Draws the image small and blurred, like bleh, so the backdrop is soft and the data URL light. */
async function blurred(img: HTMLImageElement): Promise<string | null> {
	try {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 400;
		const ctx = canvas.getContext("2d")!;
		ctx.imageSmoothingQuality = "high";
		ctx.filter = "blur(10px)";
		ctx.drawImage(img, 0, 0, 400, 400);
		return canvas.toDataURL("image/jpeg", 0.75); // a blurred image is tiny as JPEG (~10 KB), PNG would be 10x that
	} catch { return null; } // tainted canvas (cross-origin image): caller falls back to the raw url
}

function averageColour(img: HTMLImageElement): [number, number, number] | null {
	try {
		const c = document.createElement("canvas");
		c.width = c.height = 1;
		const ctx = c.getContext("2d")!;
		ctx.drawImage(img, 0, 0, 1, 1);
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		return [r, g, b];
	} catch { return null; }
}

function setAccent(rgb: [number, number, number] | null): void {
	const s = document.body.style;
	if (!rgb) { for (const k of ["hue", "sat", "lit"]) s.removeProperty(`--${k}-album`); return; }
	const { hue, sat, lit } = accentFromRgb(...rgb);
	s.setProperty("--hue-album", String(hue));
	s.setProperty("--sat-album", String(sat));
	s.setProperty("--lit-album", String(lit));
}

async function courseImageFromApi(id: string): Promise<string | null> {
	const sesskey = document.querySelector<HTMLAnchorElement>('a[href*="login/logout.php"]')?.href.match(/sesskey=(\w+)/)?.[1];
	if (!sesskey) return null;
	try {
		const res = await fetch(`${location.origin}/lib/ajax/service.php?sesskey=${sesskey}&info=core_course_get_courses_by_field`, {
			method: "POST", headers: { "Content-Type": "application/json" },
			body: JSON.stringify([{ index: 0, methodname: "core_course_get_courses_by_field", args: { field: "id", value: id } }]),
		});
		const data = await res.json();
		return data?.[0]?.data?.courses?.[0]?.overviewfiles?.[0]?.fileurl ?? null;
	} catch { return null; }
}

/** Where this page's image comes from, in order: custom → profile photo → course image → none. */
export async function pickImage(): Promise<string | null> {
	const custom = String(settings.get().bannerUrl ?? "").trim();
	if (custom) return custom;
	if (/^page-user-(profile|view)/.test(document.body.id)) {
		const src = document.querySelector<HTMLImageElement>("#page-header img.userpicture:not(.defaultuserpic), .userprofile img.userpicture:not(.defaultuserpic)")?.src;
		if (src) return src.replace(/\/f[12](\?|$)/, "/f1$1");
	}
	// cards are keyed by whatever id their link carries (course/view.php?id=, or this theme's course/section.php?id=)
	const urlId = new URLSearchParams(location.search).get("id");
	const known = (urlId && cache[urlId]) || (m.courseId() && cache[m.courseId()!]);
	if (known) return known;
	const id = m.courseId();
	if (!id) return null;
	const found = await (inflight.get(id) ?? inflight.set(id, courseImageFromApi(id)).get(id)!);
	inflight.delete(id);
	if (found) { cache[id] = found; GM_setValue(COURSE_CACHE, JSON.stringify(cache)); }
	return found;
}

/** The course a card belongs to: its data attribute, else the id in its first link. */
export const cardCourseId = (card: HTMLElement): string | undefined =>
	card.dataset.courseId ?? card.querySelector<HTMLAnchorElement>('a.courselink[href*="id="], a[href*="course/view.php?id="], a[href*="id="]')?.href.match(/[?&]id=(\d+)/)?.[1];

/** Remember each course card's image so other pages can show it. */
function harvest(roots: ParentNode[]): void {
	let changed = false, titlesChanged = false;
	const cards = roots.flatMap((r) => [...(r instanceof Element && r.matches(CARD) ? [r as HTMLElement] : []), ...r.querySelectorAll<HTMLElement>(CARD)]);
	for (const card of cards) {
		const link = card.querySelector<HTMLAnchorElement>('a.courselink[href*="id="], a[href*="course/view.php?id="], a[href*="id="]');
		const id = card.dataset.courseId ?? link?.href.match(/[?&]id=(\d+)/)?.[1];
		const bgEl = card.querySelector<HTMLElement>('[style*="background-image"], figure');
		const url = (bgEl && cssUrl(getComputedStyle(bgEl).backgroundImage))
			?? card.querySelector<HTMLImageElement>("img.courseimage, img.card-img-top")?.src;
		if (id && url && cache[id] !== url) { cache[id] = url; changed = true; }
		const title = card.querySelector<HTMLElement>("h2, h3, .coursename, .multiline")?.textContent?.replace(/\s+/g, " ").trim();
		if (id && link && title && titles[id]?.title !== title) { titles[id] = { title: title.slice(0, 120), url: link.href }; titlesChanged = true; }
	}
	if (changed) GM_setValue(COURSE_CACHE, JSON.stringify(cache));
	if (titlesChanged) GM_setValue(TITLES_KEY, JSON.stringify(titles));
}

/** Shows `data` (a blurred image) — or, when the canvas was tainted, `rawUrl` blurred by css — and applies the accent. */
function paint(data: string | null, rawUrl: string | null, rgb: Cached["rgb"]): void {
	if (!host) return;
	const inner = document.createElement("div");
	inner.className = "page-background-image-inner";
	inner.style.backgroundImage = `url(${JSON.stringify(data ?? rawUrl)})`;
	if (!data) inner.style.filter = "blur(24px)"; // canvas was tainted (cross-origin image): blur in css instead
	const wrap = document.createElement("div");
	wrap.className = "page-background-image";
	wrap.append(inner);
	host.append(wrap);
	const st = settings.get(), profile = /^page-user-(profile|view)/.test(document.body.id);
	setAccent(profile ? (st.hue_from_profile ? rgb : null) : (st.hue_from_course ? rgb : null));
	host.classList.add("ready");
}

/** `onUrl` fires as soon as the image URL is known (the cover and banner need nothing more); the blur and accent follow. */
export async function refreshBackdrop(onUrl?: (url: string | null) => void): Promise<string | null> {
	if (!host) return null;
	const gen = ++seq;
	const url = settings.get().banner ? await pickImage().catch(() => null) : null;
	if (gen !== seq || url === shownUrl) return url;
	shownUrl = url;
	onUrl?.(url);
	host.classList.remove("ready");
	host.replaceChildren();
	if (banner) {
		banner.replaceChildren();
		banner.setAttribute("data-url", url ?? "");
		if (url) { const inner = document.createElement("span"); inner.className = "background-inner"; inner.style.backgroundImage = `url(${JSON.stringify(url)})`; banner.append(inner); }
	}
	host.setAttribute("data-url", url ?? "");
	if (!url) { setAccent(null); host.classList.add("ready"); return null; }
	const hit = backdrops[url];
	if (hit) { paint(hit.d, null, hit.rgb); return url; }
	try {
		const img = await loadImage(url);
		if (gen !== seq) return url;
		const soft = await blurred(img);
		const rgb = averageColour(img);
		if (soft && soft.length < 90_000) remember(url, soft, rgb);
		if (gen !== seq) return url;
		paint(soft, url, rgb);
	} catch { setAccent(null); }
	host.classList.add("ready");
	return url;
}

let cachesLoaded = false;
function loadCaches(): void {
	if (cachesLoaded) return;
	cachesLoaded = true;
	try { cache = JSON.parse(GM_getValue(COURSE_CACHE, "{}")); } catch { cache = {}; }
	try { titles = JSON.parse(GM_getValue(TITLES_KEY, "{}")); } catch { titles = {}; }
	try { backdrops = JSON.parse(GM_getValue(BACKDROP_KEY, "{}")); } catch { backdrops = {}; }
}

/** Runs before the page content is parsed: if we already know this page's image (and its colour), set the accent now.
 *  Changing the accent later restyles every element on the page (hundreds of ms); changing it first costs nothing. */
export function earlyAccent(): void {
	const st = settings.get();
	if (!st.banner || (st.bannerUrl ?? "").trim()) return; // a custom backdrop is rare: handled the normal way
	loadCaches();
	const profile = /^page-user-(profile|view)/.test(document.body.id);
	if (profile ? !st.hue_from_profile : !st.hue_from_course) return;
	const urlId = new URLSearchParams(location.search).get("id");
	const cid = m.courseId();
	const url = (urlId && cache[urlId]) || (cid && cache[cid]) || null;
	const hit = url ? backdrops[url] : null;
	if (hit?.rgb) setAccent(hit.rgb);
}

export function mountBackdrop(): void {
	if (host || !document.body) return;
	loadCaches();
	host = document.createElement("div");
	host.className = "bleh-background katsune-bleh-background";
	banner = document.createElement("div");
	banner.className = "page-banner";
	banner.setAttribute("data-page-type", document.body.id || "page");
	document.body.append(host, banner);
	harvest([document]);
	onDomChange(harvest, false); // myoverview renders its cards over AJAX
	
}
