import type { MoodleConnection } from "./client";

const STORAGE_KEY = "moodleflow.connection";

export interface StoredConnection extends MoodleConnection {
	siteName?: string;
	userFullName?: string;
	mock?: boolean;
}

/** All Moodle credentials live only in the browser's localStorage — never sent to any MoodleFlow server. */
export function loadConnection(): StoredConnection | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as StoredConnection;
	} catch {
		return null;
	}
}

export function saveConnection(connection: StoredConnection): void {
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
}

export function clearConnection(): void {
	window.localStorage.removeItem(STORAGE_KEY);
}
