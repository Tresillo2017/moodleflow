// Small visual extras from bleh: the rain overlay (components/page/rain.js) and static/hover-play GIFs.
import * as settings from "./settings";

let rainEl: HTMLElement | undefined;

/** bleh's rain: two layers of drops with staggered delays (markup + numbers from components/page/rain.js). */
function startRain(): void {
	if (rainEl) return;
	rainEl = document.createElement("div");
	rainEl.className = "rain-container";
	rainEl.setAttribute("aria-hidden", "true");
	const layers = ["rain", "rain rain-back"].map((c, i) => {
		const layer = document.createElement("div");
		layer.className = c;
		let x = 0;
		while (x < 60) {
			const a = Math.floor(Math.random() * 98) + 1, b = Math.floor(Math.random() * 4) + 2;
			x += b;
			const anim = `animation-delay:0.${a}s;animation-duration:0.5${a}s`;
			const drop = document.createElement("div");
			drop.className = "drop";
			drop.style.cssText = `${i ? "right" : "left"}:${x}%;bottom:${b + b - 1 + 280}%;${anim}`;
			for (const part of ["stem", "splat"]) { const p = document.createElement("div"); p.className = part; p.style.cssText = anim; drop.append(p); }
			layer.append(drop);
		}
		return layer;
	});
	rainEl.append(...layers);
	document.body.append(rainEl);
}
const stopRain = () => { rainEl?.remove(); rainEl = undefined; };

// ---- GIFs: "never" freezes the first frame, "hover" plays on hover (same-origin images only; others are left alone)
const frozen = new WeakMap<HTMLImageElement, string>();
function freeze(img: HTMLImageElement, mode: "never" | "hover"): void {
	if (frozen.has(img) || !/\.gif(\?|$)/i.test(img.currentSrc || img.src) || !img.complete || !img.naturalWidth) return;
	try {
		const c = document.createElement("canvas");
		c.width = img.naturalWidth; c.height = img.naturalHeight;
		c.getContext("2d")!.drawImage(img, 0, 0);
		const still = c.toDataURL("image/png"), original = img.src;
		frozen.set(img, original);
		img.src = still;
		if (mode === "hover") { img.addEventListener("mouseenter", () => { img.src = original; }); img.addEventListener("mouseleave", () => { img.src = still; }); }
	} catch { /* cross-origin: canvas is tainted, leave the gif animated */ }
}
function unfreeze(): void { for (const img of document.images) { const o = frozen.get(img); if (o) { img.src = o; frozen.delete(img); } } }

export function applyEffects(): void {
	const s = settings.get();
	if (s.rain && !(s.reduced_motion || s.reduced_flashing)) startRain(); else stopRain();
	if (s.static_gifs === "always") unfreeze();
	else for (const img of document.images) freeze(img, s.static_gifs);
}
export function mountEffects(): void {
	applyEffects();
	settings.subscribe((_, changed) => { if (changed.some((k) => ["rain", "static_gifs", "reduced_motion", "reduced_flashing"].includes(k))) applyEffects(); });
	addEventListener("load", applyEffects, { once: true });
}
