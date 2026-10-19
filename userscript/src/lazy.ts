// Chunks build.mjs split out of the main stylesheet because they are huge embedded images that only matter sometimes:
// seasonal decorations (when a season is active), a theme's paper/overlay art (when that theme is selected), and a
// catch-all that loads when the page is idle. Each is injected once.
import chunks from "../dist/lazy.json";

const added = new Set<string>();
const inject = (key: string) => {
	const css = (chunks as Record<string, string>)[key];
	if (!css || added.has(key)) return;
	added.add(key);
	const el = document.createElement("style");
	el.setAttribute("data-mf-lazy", key);
	el.textContent = css;
	document.head.append(el);
};

/** Call after the theme/season attributes on <body> are up to date. Chunks are injected here, in the same task as the
 *  main sheet and before the page content is styled: adding a stylesheet later restyles the whole page (measured at
 *  ~100ms each on a real course page), so "lazy" means "not parsed unless needed", never "added after first paint". */
export function applyLazy(): void {
	const b = document.body;
	inject("icons");
	inject("other");
	const theme = b.getAttribute("data-bleh--theme");
	if (theme) inject(`theme:${theme}`);
	if (b.hasAttribute("data-bleh--season")) inject("season");
}
