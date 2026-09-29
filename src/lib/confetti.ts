/** Confetti burst for a finished submission. Loaded on demand; skipped under reduced motion. */
export async function celebrate(): Promise<void> {
	if (document.documentElement.dataset.motion === "reduced") return;
	const { default: confetti } = await import("canvas-confetti");
	const base = { disableForReducedMotion: true, zIndex: 2000, ticks: 220 } as const;
	confetti({ ...base, particleCount: 90, spread: 70, origin: { y: 0.65 } });
	setTimeout(() => {
		confetti({ ...base, particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
		confetti({ ...base, particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
	}, 180);
}
