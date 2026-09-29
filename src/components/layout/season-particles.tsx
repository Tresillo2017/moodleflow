"use client";

import { useMemo } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { SEASONS, activeSeason } from "@/lib/preferences";

const LESS = 0.45;
const MOBILE = 0.5;

/** Falling snow for seasons that have it. Flake maths follows bleh's begin_snowflakes (fm/src/components/seasonal.ts, GPL-3.0). */
export function SeasonParticles() {
	const { prefs } = usePreferences();
	const season = activeSeason(prefs);
	const base = season ? SEASONS[season].snow : 0;
	const enabled = base > 0 && prefs.particles !== "none" && prefs.motion !== "reduced";

	const flakes = useMemo(() => {
		if (!enabled) return [];
		let count = base;
		if (prefs.particles === "less" && count > 10) count *= LESS;
		if (window.matchMedia("(max-width: 980px)").matches && count > 10) count *= MOBILE;
		return Array.from({ length: Math.floor(count * 0.7) }, () => {
			const scale = Math.random() * 0.9 + 0.4;
			return {
				x: (Math.random() * 100).toFixed(1),
				drift: (Math.random() * 40 - 10).toFixed(1),
				scale: scale.toFixed(1),
				size: 8 * scale,
				duration: (Math.random() * 64 + 20).toFixed(1),
				delay: (Math.random() * -30).toFixed(1),
				opacity: (Math.random() * 0.7 + 0.2).toFixed(1),
			};
		});
	}, [enabled, base, prefs.particles]);

	if (!flakes.length) return null;
	return (
		<div className="snow-container" aria-hidden="true">
			{flakes.map((f, i) => (
				<div
					key={i}
					className="snow"
					style={{
						width: f.size,
						height: f.size,
						["--x" as string]: `${f.x}vw`,
						["--x-end" as string]: `calc(${f.x}vw + ${f.drift}vw)`,
						["--s" as string]: f.scale,
						animationDuration: `${f.duration}s`,
						animationDelay: `${f.delay}s`,
						opacity: f.opacity,
					}}
				/>
			))}
		</div>
	);
}
