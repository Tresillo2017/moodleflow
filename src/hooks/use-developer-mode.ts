"use client";

import { useCallback, useEffect, useState } from "react";
import { readPersisted, removePersisted, writePersisted } from "@/lib/persist";

const KEY = "moodleflow.developer";
const CHANGED = "moodleflow:developer-changed";

/** Developer mode: unlocked by tapping the version number in Settings; shows the developer tools page. */
export function useDeveloperMode() {
	const [enabled, setEnabledState] = useState<boolean | null>(null);

	useEffect(() => {
		const read = () => setEnabledState(readPersisted(KEY) === "1");
		read();
		window.addEventListener(CHANGED, read);
		window.addEventListener("storage", read);
		return () => {
			window.removeEventListener(CHANGED, read);
			window.removeEventListener("storage", read);
		};
	}, []);

	const setEnabled = useCallback((on: boolean) => {
		if (on) writePersisted(KEY, "1");
		else removePersisted(KEY);
		window.dispatchEvent(new Event(CHANGED));
	}, []);

	return { enabled: enabled === true, ready: enabled !== null, setEnabled };
}
