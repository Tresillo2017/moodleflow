"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { createMoodleClient, type MoodleClient } from "@/lib/moodle/client";
import { createMockMoodleClient } from "@/lib/moodle/mock";
import { idbStore } from "@/lib/idb-store";
import { createSwrCache } from "@/lib/swr-cache";
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

const MINUTE = 60_000;
/** How long each resource counts as fresh; older data is shown instantly and refetched in the background. */
const TTL = { siteInfo: 24 * 60 * MINUTE, courses: 10 * MINUTE, contents: 10 * MINUTE, events: 5 * MINUTE, assignments: 2 * MINUTE, grades: 10 * MINUTE, forum: 2 * MINUTE, notifications: MINUTE };

/** Fired on window when a query fails with an invalid/expired token; the provider then signs out and asks to log in again. */
export const SESSION_EXPIRED = "moodleflow:session-expired";

/** Fired on window when a background revalidation replaced cached data, so mounted queries re-read it. */
export const CACHE_UPDATED = "moodleflow:cache-updated";

/**
 * Stale-while-revalidate cache (persisted in IndexedDB unless demo mode) so pages show instantly, even offline;
 * mutations invalidate what they touch. Failed reads aren't cached.
 */
function withCache(client: MoodleClient, persist: boolean): MoodleClient {
	const { cached, invalidate } = createSwrCache(persist ? idbStore : null, () => window.dispatchEvent(new Event(CACHE_UPDATED)));
	let functions: Set<string> | null = null;
	const siteInfo = cached("siteInfo", TTL.siteInfo, () => client.getSiteInfo());

	function invalidateAssignments() {
		invalidate("assignments");
		invalidate("assignment");
	}

	function notificationsChanged() {
		invalidate("notifications");
		window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
	}

	return {
		async getSiteInfo() {
			const info = await siteInfo();
			// A real site always lists some functions; an empty list (demo mode) means "unknown, assume supported".
			functions = info.functions.length ? new Set(info.functions) : null;
			return info;
		},
		getSiteConfig: cached("siteConfig", TTL.siteInfo, () => client.getSiteConfig()),
		supports: (fn) => functions?.has(fn) ?? client.supports(fn),
		getCurrentUser: cached("user", TTL.siteInfo, () => client.getCurrentUser()),
		getCourses: cached("courses", TTL.courses, () => client.getCourses()),
		async setCourseFavourite(courseId, favourite) {
			await client.setCourseFavourite(courseId, favourite);
			invalidate("courses");
		},
		getCourseContents: cached("contents", TTL.contents, (courseId: number) => client.getCourseContents(courseId)),
		getCourseNavOptions: cached("navOptions", TTL.contents, (id: number) => client.getCourseNavOptions(id)),
		getParticipants: cached("participants", TTL.courses, (id: number) => client.getParticipants(id)),
		getCourseCompletion: cached("courseCompletion", TTL.contents, (id: number) => client.getCourseCompletion(id)),
		async selfCompleteCourse(id) {
			await client.selfCompleteCourse(id);
			invalidate("courseCompletion");
			invalidate("courses");
		},
		getCourseBlocks: cached("blocks", TTL.contents, (id: number) => client.getCourseBlocks(id)),
		getUpdatedModules: (id, since) => client.getUpdatedModules(id, since), // depends on "since", so uncached
		async setActivityCompletion(cmid, completed) {
			await client.setActivityCompletion(cmid, completed);
			invalidate("contents");
			invalidate("courseCompletion");
		},
		getCalendarEvents: cached("events", TTL.events, () => client.getCalendarEvents()),
		getAssignments: cached("assignments", TTL.assignments, (courseIds?: number[]) => client.getAssignments(courseIds)),
		getAssignment: cached("assignment", TTL.assignments, (id: number) => client.getAssignment(id)),
		getGrades: cached("grades", TTL.grades, (courseId?: number) => client.getGrades(courseId)),
		getForumDiscussions: cached("forum", TTL.forum, (forumId: number) => client.getForumDiscussions(forumId)),
		fileUrl: (url, opts) => client.fileUrl(url, opts),
		getNotifications: cached("notifications", TTL.notifications, () => client.getNotifications()),
		async markNotificationRead(id) {
			await client.markNotificationRead(id);
			notificationsChanged();
		},
		async markAllNotificationsRead() {
			await client.markAllNotificationsRead();
			notificationsChanged();
		},
		async saveAssignmentSubmission(assignment, input) {
			await client.saveAssignmentSubmission(assignment, input);
			invalidateAssignments();
		},
		async removeAssignmentSubmission(id) {
			await client.removeAssignmentSubmission(id);
			invalidateAssignments();
		},
		getSubmissionComments: (a) => client.getSubmissionComments(a),
		async addSubmissionComment(a, content) {
			await client.addSubmissionComment(a, content);
		},
		async submitAssignmentForGrading(id) {
			await client.submitAssignmentForGrading(id);
			invalidateAssignments();
		},
		uploadFiles: (files, opts) => client.uploadFiles(files, opts),
		async logActivityView(target) {
			const logged = await client.logActivityView(target);
			if (logged) invalidate("contents"); // completion may have changed
			return logged;
		},
		async logCourseView(courseId) {
			const logged = await client.logCourseView(courseId);
			if (logged) invalidate("contents");
			return logged;
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
		return withCache(connection.mock ? createMockMoodleClient() : createMoodleClient(connection), !connection.mock);
		// generation is a deliberate cache-buster
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [connection, generation]);

	const router = useRouter();
	useEffect(() => {
		const onExpired = () => {
			if (!connection || connection.mock) return;
			void idbStore.clear().catch(() => {});
			clearConnection();
			setConnection(null);
			toast.error("Your Moodle session expired. Sign in again.");
			router.replace(`/connect?site=${encodeURIComponent(connection.siteUrl)}`);
		};
		window.addEventListener(SESSION_EXPIRED, onExpired);
		return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
	}, [connection, router]);

	const value: MoodleContextValue = {
		connection,
		client,
		loading,
		connect: (next) => {
			// cached data belongs to whoever was signed in before
			void idbStore.clear().catch(() => {});
			saveConnection(next);
			setConnection(next);
		},
		disconnect: () => {
			void idbStore.clear().catch(() => {});
			clearConnection();
			setConnection(null);
		},
		refresh: () => {
			// wait for the persisted copy to go, or the new client would serve it as "stale" data
			void idbStore.clear().catch(() => {}).finally(() => setGeneration((g) => g + 1));
		},
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
