"use client";

import { useEffect } from "react";
import { toast } from "@/lib/toast";
import { applyUpdate, checkForUpdate, getUpdateState } from "@/lib/updater";

const CHECK_EVERY_MS = 5 * 60 * 1000;

/** The "new version available" toast; Reload remembers the version so the next load can show its notes. */
export function showUpdateToast(version?: string) {
	return toast.info("A new version of MoodleFlow is available", {
		description: version ? `v${version} is ready. Reload to update.` : "Reload to update.",
		duration: null,
		button: { title: "Reload", onClick: () => applyUpdate(version) },
	});
}

/** Checks in the background and asks the user to reload once the deployed build differs from this tab's. */
export function UpdatePrompt() {
	useEffect(() => {
		let notified = false;

		async function check() {
			if (notified || document.visibilityState !== "visible") return;
			if ((await checkForUpdate()) !== "available") return;
			notified = true;
			showUpdateToast(getUpdateState().latest?.version);
		}

		void check();
		const timer = setInterval(check, CHECK_EVERY_MS);
		document.addEventListener("visibilitychange", check);
		return () => {
			clearInterval(timer);
			document.removeEventListener("visibilitychange", check);
		};
	}, []);

	return null;
}
