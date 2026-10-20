// Submitting an assignment: the button shows it is working, and when the submission lands (the status says "Submitted
// for grading") the status card pops, a toast appears and confetti falls. Works across the redirect Moodle does after
// saving by leaving a short-lived flag in sessionStorage. Inside the activity popout (a frame) it asks the page above.
import * as settings from "./settings";
import { FRAME_NAME } from "./popout";
import { h } from "./dom";

const FLAG = "mf:submitted", FRESH_MS = 2 * 60e3;
const inFrame = typeof window !== "undefined" && window.name === FRAME_NAME && window.top !== window;
const motionOk = () => !settings.get().reduced_motion && !matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Pure: is a flag set at `at` still worth acting on at `now`? */
export const isFresh = (at: number, now: number): boolean => now - at >= 0 && now - at < FRESH_MS;

type Bit = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; life: number };
/** Pure-ish: the particles for one burst from two cannons in the bottom corners, coloured around the accent hue. */
export function burst(width: number, height: number, hue: number, count = 150, rnd: () => number = Math.random): Bit[] {
	const colours = [hue, hue + 40, hue - 40, hue + 180, 48, 0].map((hh, i) => `oklch(${i === 4 ? 0.85 : 0.75} ${i === 5 ? 0 : 0.17} ${hh})`);
	return Array.from({ length: count }, (_, i) => {
		const left = i % 2 === 0, a = (rnd() * 0.5 + 0.25) * Math.PI / 2; // angled up and inwards
		const speed = 16 + rnd() * 14;
		return { x: left ? 0 : width, y: height, vx: Math.cos(a) * speed * (left ? 1 : -1), vy: -Math.sin(a) * speed * 1.15, r: rnd() * 6, vr: (rnd() - 0.5) * 0.4, w: 6 + rnd() * 6, h: 4 + rnd() * 5, c: colours[Math.floor(rnd() * colours.length)], life: 0 };
	});
}

export function confetti(): void {
	if (!motionOk()) return;
	const canvas = h("canvas", { class: "mf-confetti", "aria-hidden": "true" });
	canvas.width = innerWidth; canvas.height = innerHeight;
	document.body.append(canvas);
	const ctx = canvas.getContext("2d")!;
	const hue = +(getComputedStyle(document.body).getPropertyValue("--hue-album") || getComputedStyle(document.body).getPropertyValue("--hue-user") || 298) || 298;
	const bits = burst(canvas.width, canvas.height, hue);
	let last = performance.now();
	const tick = (now: number) => {
		const dt = Math.min(2, (now - last) / 16.7); last = now;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		let alive = 0;
		for (const b of bits) {
			b.vy += 0.35 * dt; b.vx *= 0.99; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt; b.life += dt;
			if (b.y > canvas.height + 20 && b.vy > 0) continue;
			alive++;
			ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.scale(1, Math.cos(b.r * 1.7));
			ctx.globalAlpha = Math.min(1, (360 - b.life) / 60); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
		}
		if (alive && bits[0].life < 360) requestAnimationFrame(tick); else canvas.remove();
	};
	requestAnimationFrame(tick);
}

function toast(text: string, sub: string): void {
	const el = h("div", { class: "mf-toast", role: "status" }, h("div", { class: "mf-toast-text" }, h("strong", {}, text), h("span", {}, sub)));
	document.body.append(el);
	setTimeout(() => { el.classList.add("to-remove"); setTimeout(() => el.remove(), 300); }, 4000);
}
function celebrate(): void {
	if (inFrame) { window.parent.postMessage({ mfCelebrate: true }, location.origin); }
	else { confetti(); toast("Submitted", "Your assignment is in. Nice work."); }
}

const isAssign = () => /\bpath-mod-assign\b/.test(document.body.className);
function onSubmit(e: SubmitEvent): void {
	if (!settings.get().confetti || !isAssign()) return;
	const btn = e.submitter as HTMLElement | null;
	btn?.classList.add("mf-busy");
	btn?.setAttribute("aria-busy", "true");
	try { sessionStorage.setItem(FLAG, String(Date.now())); } catch { /* private mode */ }
}

function onLanded(): void {
	const at = +(sessionStorage.getItem(FLAG) ?? 0);
	if (!at || !isAssign()) return;
	const status = document.querySelector<HTMLElement>(".submissionstatussubmitted");
	const onViewPage = !new URLSearchParams(location.search).has("action") && !!document.querySelector(".submissionstatustable, .submissionstatus");
	if (!onViewPage) return; // still on the edit / confirm screens: keep the flag for the redirect target
	sessionStorage.removeItem(FLAG);
	if (!status || !isFresh(at, Date.now())) return; // saved as a draft, or an old flag
	status.classList.add("mf-pop");
	celebrate();
}

export function mountCelebrate(): void {
	document.addEventListener("submit", onSubmit, true);
	if (!inFrame) addEventListener("message", (e) => { if (e.origin === location.origin && e.data?.mfCelebrate && settings.get().confetti) { confetti(); toast("Submitted", "Your assignment is in. Nice work."); } });
	if (settings.get().confetti) onLanded();
}
