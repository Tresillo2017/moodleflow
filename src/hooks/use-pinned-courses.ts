"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { togglePinned } from "@/lib/preferences";

export function usePinnedCourses() {
	const { prefs, setPref } = usePreferences();
	return {
		pinnedIds: prefs.pinnedCourses,
		isPinned: (id: number) => prefs.pinnedCourses.includes(id),
		toggle: (id: number) => setPref("pinnedCourses", togglePinned(prefs.pinnedCourses, id)),
	};
}
