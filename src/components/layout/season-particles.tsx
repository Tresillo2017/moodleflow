"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { SEASONS, activeSeason } from "@/lib/preferences";

const COUNT = 18;

/** Slow falling emoji for the current season, like bleh's snow. Decorative only. */
export function SeasonParticles() {
	const { prefs } = usePreferences();
	const season = activeSeason(prefs);
	const emoji = season ? SEASONS[season].emoji : "";
	if (!emoji || prefs.particles === "off" || prefs.motion === "reduced") return null;

	return (
		<div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden motion-reduce:hidden">
			{Array.from({ length: COUNT }, (_, i) => (
				<span
					key={i}
					className="absolute top-0 opacity-60"
					style={{
						left: `${(i * 97) % 100}%`,
						fontSize: `${12 + ((i * 7) % 10)}px`,
						animation: `season-fall ${14 + ((i * 5) % 12)}s linear ${-((i * 3) % 14)}s infinite`,
						["--drift" as string]: `${((i * 41) % 90) - 45}px`,
					}}
				>
					{emoji}
				</span>
			))}
		</div>
	);
}
