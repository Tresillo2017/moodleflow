"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import {
	DEFAULT_PREFERENCES,
	applyAppearance,
	loadPreferences,
	savePreferences,
	type Preferences,
} from "@/lib/preferences";

interface PreferencesContextValue {
	prefs: Preferences;
	setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
	reset: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
	const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);

	// The <head> script already applied stored appearance; this only syncs React state.
	useEffect(() => setPrefs(loadPreferences()), []);

	function commit(next: Preferences) {
		setPrefs(next);
		savePreferences(next);
		applyAppearance(next);
	}

	const value: PreferencesContextValue = {
		prefs,
		setPref: (key, value) => commit({ ...prefs, [key]: value }),
		reset: () => commit(DEFAULT_PREFERENCES),
	};

	return (
		<PreferencesContext.Provider value={value}>
			<MotionConfig reducedMotion={prefs.motion === "reduced" ? "always" : "user"}>{children}</MotionConfig>
		</PreferencesContext.Provider>
	);
}

export function usePreferences(): PreferencesContextValue {
	const ctx = useContext(PreferencesContext);
	if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
	return ctx;
}
