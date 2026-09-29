"use client";

import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import type { ActivityType, MoodleActivity } from "@/types/moodle";

/** Finds a course activity by module instance, for pages (chat, meetings) that only get `?course=` and an instance id. */
export function useActivity(courseId: number | null, type: ActivityType, instance: number) {
	const { client } = useMoodleConnection();
	const contents = useMoodleQuery(client && courseId ? () => client.getCourseContents(courseId) : null, [client, courseId]);
	const activity: MoodleActivity | undefined = contents.data?.sections.flatMap((s) => s.activities).find((a) => a.type === type && a.instance === instance);
	return { activity, loading: contents.loading, error: contents.error };
}
