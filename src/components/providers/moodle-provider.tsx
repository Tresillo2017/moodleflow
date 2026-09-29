"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createMoodleClient, type MoodleClient } from "@/lib/moodle/client";
import { createMockMoodleClient } from "@/lib/moodle/mock";
import {
	clearConnection,
	loadConnection,
	saveConnection,
	type StoredConnection,
} from "@/lib/moodle/connection";

/** Fired on window after notifications change, so unread badges can refetch. */
export const NOTIFICATIONS_CHANGED = "moodleflow:notifications-changed";

interface MoodleContextValue {
	connection: StoredConnection | null;
	client: MoodleClient | null;
	loading: boolean;
	connect: (connection: StoredConnection) => void;
	disconnect: () => void;
	/** Drops cached responses; every mounted query refetches. */
	refresh: () => void;
}

const MoodleContext = createContext<MoodleContextValue | null>(null);

/**
 * Shares read results across pages so navigating doesn't refetch; mutations
 * invalidate what they touch. Failed reads aren't cached.
 * ponytail: no TTL, data lives until refresh() or reload; add one if stale data bites.
 */
function withCache(client: MoodleClient): MoodleClient {
	const cache = new Map<string, Promise<unknown>>();

	function cached<A extends unknown[], T>(name: string, fn: (...args: A) => Promise<T>) {
		return (...args: A): Promise<T> => {
			const key = `${name}:${JSON.stringify(args)}`;
			const hit = cache.get(key) as Promise<T> | undefined;
			if (hit) return hit;
			const request = fn(...args).catch((error: unknown) => {
				cache.delete(key);
				throw error;
			});
			cache.set(key, request);
			return request;
		};
	}

	function invalidate(name: string) {
		for (const key of cache.keys()) if (key.startsWith(`${name}:`)) cache.delete(key);
	}

	function notificationsChanged() {
		invalidate("notifications");
		window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
	}

	return {
		getSiteInfo: cached("siteInfo", () => client.getSiteInfo()),
		getCurrentUser: cached("user", () => client.getCurrentUser()),
		getCourses: cached("courses", () => client.getCourses()),
		getCourseContents: cached("contents", (courseId: number) => client.getCourseContents(courseId)),
		getCalendarEvents: cached("events", () => client.getCalendarEvents()),
		getAssignments: cached("assignments", () => client.getAssignments()),
		getGrades: cached("grades", (courseId?: number) => client.getGrades(courseId)),
		getNotifications: cached("notifications", () => client.getNotifications()),
		async markNotificationRead(id) {
			await client.markNotificationRead(id);
			notificationsChanged();
		},
		async markAllNotificationsRead() {
			await client.markAllNotificationsRead();
			notificationsChanged();
		},
		async submitAssignmentText(id, text) {
			await client.submitAssignmentText(id, text);
			invalidate("assignments");
		},
	};
}

export function MoodleProvider({ children }: { children: React.ReactNode }) {
	const [connection, setConnection] = useState<StoredConnection | null>(null);
	const [loading, setLoading] = useState(true);
	const [generation, setGeneration] = useState(0);

	useEffect(() => {
		setConnection(loadConnection());
		setLoading(false);
	}, []);

	const client = useMemo<MoodleClient | null>(() => {
		if (!connection) return null;
		return withCache(connection.mock ? createMockMoodleClient() : createMoodleClient(connection));
		// generation is a deliberate cache-buster
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [connection, generation]);

	const value: MoodleContextValue = {
		connection,
		client,
		loading,
		connect: (next) => {
			saveConnection(next);
			setConnection(next);
		},
		disconnect: () => {
			clearConnection();
			setConnection(null);
		},
		refresh: () => setGeneration((g) => g + 1),
	};

	return <MoodleContext.Provider value={value}>{children}</MoodleContext.Provider>;
}

export function useMoodleConnection(): MoodleContextValue {
	const ctx = useContext(MoodleContext);
	if (!ctx) throw new Error("useMoodleConnection must be used within MoodleProvider");
	return ctx;
}

/** Redirects to /connect when no client is available; use in (app) pages. */
export function useRequireMoodleClient(): MoodleClient | null {
	const { client, loading } = useMoodleConnection();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !client) router.replace("/connect");
	}, [loading, client, router]);

	return client;
}
