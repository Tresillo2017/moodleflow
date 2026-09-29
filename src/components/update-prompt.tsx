"use client";

import { useEffect } from "react";
import { toast } from "@/lib/toast";
import { PENDING_VERSION_KEY } from "@/lib/whats-new";

const CHECK_EVERY_MS = 5 * 60 * 1000;

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
				toast.info("A new version of MoodleFlow is available", {
					description: latest.version ? `v${latest.version} is ready. Reload to update.` : "Reload to update.",
					duration: null,
					button: {
						title: "Reload",
						onClick: () => {
							// remembered so the next load can show what's new
							try {
								if (latest.version) window.localStorage.setItem(PENDING_VERSION_KEY, latest.version);
							} catch {}
							window.location.reload();
						},
					},
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
