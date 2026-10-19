// bleh's seasons (build/seasonal.tsx): date ranges that set data-bleh--season (themes.css re-tints accents and
// overlays for them) and optionally drop snowflakes. Dates and particle counts are bleh's own.
import * as settings from "./settings";

export type Season = { id: string; name: string; start: [number, number]; end: [number, number]; flakes: number };

export const SEASONS: Season[] = [
	{ id: "new_years", name: "New Year", start: [1, 1], end: [1, 14], flakes: 90 },
	{ id: "easter", name: "Easter", start: [4, 2], end: [4, 30], flakes: 0 },
	{ id: "pride", name: "Pride", start: [6, 1], end: [6, 30], flakes: 0 },
	{ id: "summer", name: "Summer", start: [7, 1], end: [9, 10], flakes: 0 },
	{ id: "halloween", name: "Halloween", start: [9, 24], end: [10, 31], flakes: 0 },
	{ id: "pre_fall", name: "Pre-fall", start: [11, 1], end: [11, 12], flakes: 12 },
	{ id: "fall", name: "Fall", start: [11, 13], end: [11, 22], flakes: 80 },
	{ id: "christmas", name: "Christmas", start: [11, 23], end: [12, 31], flakes: 160 },
];

const at = (d: [number, number], year: number, end: boolean) => new Date(year, d[0] - 1, d[1], end ? 23 : 0, end ? 59 : 0, end ? 59 : 0);

/** Pure: the season active at `now` (or undefined) and the next one to start. */
export function seasonState(now: Date): { current?: Season; next: Season } {
	const y = now.getFullYear();
	const current = SEASONS.find((s) => now >= at(s.start, y, false) && now <= at(s.end, y, true));
	const upcoming = SEASONS.filter((s) => at(s.start, y, false) > now);
	return { current, next: upcoming[0] ?? SEASONS[0] };
}

export const rangeLabel = (s: Season): string => {
	const f = (d: [number, number]) => new Date(2000, d[0] - 1, d[1]).toLocaleDateString(undefined, { month: "short", day: "numeric" });
	return `${f(s.start)} – ${f(s.end)}`;
};

let container: HTMLElement | undefined;
let shown = "";

function flakes(count: number): void {
	const wrap = container!;
	wrap.replaceChildren();
	const n = Math.round(count * 0.7);
	for (let i = 0; i < n; i++) {
		const x = Math.random() * 100, drift = Math.random() * 40 - 10, scale = Math.random() * 0.9 + 0.4;
		const f = document.createElement("div");
		f.className = "snow";
		f.style.cssText = `width:${8 * scale}px;height:${8 * scale}px;--x:${x.toFixed(1)}vw;--x-end:calc(${x.toFixed(1)}vw + ${drift.toFixed(1)}vw);--s:${scale.toFixed(1)};` +
			`animation-duration:${(Math.random() * 64 + 20).toFixed(1)}s;animation-delay:${(Math.random() * -30).toFixed(1)}s;opacity:${(Math.random() * 0.7 + 0.2).toFixed(1)}`;
		wrap.append(f);
	}
}

export function applySeason(now = new Date()): void {
	const s = settings.get();
	const body = document.body;
	const { current } = seasonState(now);
	const active = s.seasonal ? current : undefined;
	if (active) body.setAttribute("data-bleh--season", active.id); else body.removeAttribute("data-bleh--season");
	const motionOff = s.reduced_motion || matchMedia("(prefers-reduced-motion: reduce)").matches;
	let count = active && s.seasonal_particles !== "none" && !motionOff ? active.flakes : 0;
	if (count > 10 && s.seasonal_particles === "less") count *= 0.45;
	if (count > 10 && innerWidth < 980) count *= 0.5;
	const key = `${active?.id ?? ""}:${Math.round(count)}`;
	if (key === shown) return;
	shown = key;
	if (!count) { container?.remove(); container = undefined; return; }
	if (!container) { container = document.createElement("div"); container.className = "snow-container"; container.setAttribute("aria-hidden", "true"); document.body.append(container); }
	flakes(count);
}

export function mountSeasonal(): void {
	applySeason();
	setInterval(() => applySeason(), 30_000); // bleh re-checks every 30s too
	settings.subscribe((_, changed) => { if (changed.some((k) => k.startsWith("seasonal") || k === "reduced_motion")) applySeason(); });
}
