"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const CHECK_EVERY_MS = 5 * 60 * 1000;
const TOAST_ID = "app-update";

/** Asks the user to reload once the deployed build differs from the one this tab loaded. */
export function UpdatePrompt() {
	useEffect(() => {
		const current = process.env.NEXT_PUBLIC_BUILD_ID;
		let notified = false;

		async function check() {
			if (notified || document.visibilityState !== "visible") return;
			try {
				const res = await fetch("/api/version", { cache: "no-store" });
				if (!res.ok) return;
				const latest = (await res.json()) as { build?: string; version?: string };
				if (!latest.build || latest.build === current) return;
				notified = true;
				toast("A new version of MoodleFlow is available", {
					id: TOAST_ID,
					description: latest.version ? `v${latest.version} is ready. Reload to update.` : "Reload to update.",
					duration: Infinity,
					action: { label: "Reload", onClick: () => window.location.reload() },
				});
			} catch {
				// offline or mid-deploy: try again on the next check
			}
		}

		const timer = setInterval(check, CHECK_EVERY_MS);
		document.addEventListener("visibilitychange", check);
		return () => {
			clearInterval(timer);
			document.removeEventListener("visibilitychange", check);
		};
	}, []);

	return null;
}
