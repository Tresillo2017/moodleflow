"use client";

import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import type { MoodleForum } from "@/types/moodle";

/**
 * A forum by id. With the course id (`?course=`) it's one call; without it, the user's courses are searched.
 * Resolves to null when no course has it.
 */
export function useForum(forumId: number, courseId: number | null) {
	const { client } = useMoodleConnection();
	return useMoodleQuery<MoodleForum | null>(
		client
			? async () => {
					const courseIds = courseId ? [courseId] : (await client.getCourses()).map((c) => c.id);
					for (const id of courseIds) {
						const found = (await client.getForums(id)).find((f) => f.id === forumId);
						if (found) return found;
					}
					return null;
				}
			: null,
		[client, forumId, courseId],
	);
}
