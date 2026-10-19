// A site theme hardcodes light surfaces and dark text in far more places than we can name (tables, cards, buttons…).
// On dark themes we look at what is actually painted: anything still light gets bleh's card colour, dark text gets
// bleh's text colour. Computed colours come back as rgb() or oklch(); both are parsed. Each element is read once.
import * as settings from "./settings";
import { effectiveTheme } from "./apply";
import { THEMES } from "./settings";
import { onDomChange } from "./watch";

const SKIP = "img,svg,video,canvas,iframe,picture,object,embed,input,select,textarea,option,progress,.theme-preview,.theme-preview *,.tox,.tox *,.h5p-content,.bleh-icon,#mf-banner,.bleh-background,.page-banner,.page-header-avatar,.snow-container,.rain-container,.swatch,.colour-tile,[data-mf-keep]";

export function lightness(color: string): { l: number; a: number } | null {
	const ok = color.match(/^oklch\(\s*([\d.]+)(%?)\s+[\d.]+\s+[\d.]+(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/);
	if (ok) return { l: +ok[1] / (ok[2] ? 100 : 1), a: ok[3] === undefined ? 1 : +ok[3] / (ok[4] ? 100 : 1) };
	const rgb = color.match(/^(rgba?\(|color\(srgb\s+)\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/);
	if (!rgb) return null;
	const scale = rgb[1].startsWith("color") ? 1 : 255;
	const [r, g, b] = [rgb[2], rgb[3], rgb[4]].map(Number);
	return { l: (0.2126 * r + 0.7152 * g + 0.0722 * b) / scale, a: rgb[5] === undefined ? 1 : +rgb[5] / (rgb[6] ? 100 : 1) };
}
const isLight = (c: string) => { const v = lightness(c); return !!v && v.a > 0.5 && v.l > 0.8; };
const isDarkInk = (c: string) => { const v = lightness(c); return !!v && v.a > 0.5 && v.l < 0.5; };

/** Tags for one element: bg = light surface, tx = dark text, bd = light border. */
export function tagsFor(cs: Pick<CSSStyleDeclaration, "backgroundColor" | "borderTopColor" | "borderTopWidth" | "color">): string {
	const t: string[] = [];
	if (isLight(cs.backgroundColor)) t.push("bg");
	if (isDarkInk(cs.color)) t.push("tx");
	if (parseFloat(cs.borderTopWidth) > 0 && isLight(cs.borderTopColor)) t.push("bd");
	return t.join(" ");
}

let seen = new WeakSet<Element>();
let on = false;
const SKIP_CLOSEST = ".masthead, .toolbar, .navlist, .bleh-modals, [data-mf-settings], [data-mf-hidden]";
const queue: Element[] = [];
let scheduled = false;

/** Candidate elements under `root`, skipping whole subtrees we never touch (cheaper than closest() per element). */
function* candidates(root: Element): Generator<HTMLElement> {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
		acceptNode: (n) => ((n as Element).matches(SKIP) || (n as Element).matches(SKIP_CLOSEST) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
	});
	if (root instanceof HTMLElement && !root.matches(SKIP) && !root.matches(SKIP_CLOSEST) && !root.closest(SKIP_CLOSEST)) yield root;
	else if (root.closest(SKIP_CLOSEST) || root.matches(SKIP)) return;
	for (let n = walker.nextNode(); n; n = walker.nextNode()) yield n as HTMLElement;
}

/** Process queued subtrees in slices of ~8ms so a big page never blocks input: read a slice's styles, then write its tags. */
function work(deadline: { timeRemaining(): number }): void {
	scheduled = false;
	const t0 = performance.now();
	while (queue.length && (deadline.timeRemaining() > 2 || performance.now() - t0 < 8)) {
		const found: [HTMLElement, string][] = [];
		const root = queue[0];
		const it = (root as any).__mfIt ??= candidates(root);
		let n = 0;
		for (let r = it.next(); !r.done; r = it.next()) {
			const el = r.value as HTMLElement;
			if (seen.has(el)) continue;
			seen.add(el);
			const cs = getComputedStyle(el);
			let tags = tagsFor(cs);
			if (cs.backgroundImage !== "none") tags = tags.replace(/\bbg\b ?/, "").trim(); // pictures and gradients keep their own background
			if (tags) found.push([el, tags]);
			if (++n >= 250) break;
		}
		for (const [el, tags] of found) el.setAttribute("data-mf-fix", tags);
		if (n < 250) { delete (root as any).__mfIt; queue.shift(); }
		if (performance.now() - t0 > 12) break;
	}
	if (queue.length) schedule();
}
function schedule(): void {
	if (scheduled) return;
	scheduled = true;
	"requestIdleCallback" in window ? requestIdleCallback(work, { timeout: 300 }) : setTimeout(() => work({ timeRemaining: () => 8 }), 16);
}
const enqueue = (roots: Element[]) => { queue.push(...roots); schedule(); };

function refresh(): void {
	const s = settings.get();
	const dark = THEMES.find((t) => t.id === effectiveTheme(s))?.type === "dark";
	if (!dark) {
		if (on) { document.querySelectorAll("[data-mf-fix]").forEach((e) => e.removeAttribute("data-mf-fix")); seen = new WeakSet(); queue.length = 0; }
		on = false;
		return;
	}
	if (!on) { seen = new WeakSet(); on = true; }
	enqueue([document.body]);
}

export function mountFix(): void {
	onDomChange((added) => { if (on) enqueue(added); }, false);
	refresh();
	settings.subscribe((_, changed) => { if (changed.some((k) => k === "theme" || k === "theme_schedule" || k === "theme_day" || k === "theme_night")) setTimeout(refresh, 60); });
	addEventListener("load", () => setTimeout(refresh, 300), { once: true });
	matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => setTimeout(refresh, 60));
}
