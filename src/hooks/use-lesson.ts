"use client";

import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import type { LessonInfo } from "@/types/lesson";

/**
 * A lesson by id. With the course id (`?course=`) it's one call; without it, the user's courses are searched.
 * Resolves to null when no course has it.
 */
export function useLesson(lessonId: number, courseId: number | null) {
	const { client } = useMoodleConnection();
	return useMoodleQuery<LessonInfo | null>(
		client
			? async () => {
					const courseIds = courseId ? [courseId] : (await client.getCourses()).map((c) => c.id);
					for (const id of courseIds) {
						const found = (await client.getLessons(id)).find((l) => l.id === lessonId);
						if (found) return found;
					}
					return null;
				}
			: null,
		[client, lessonId, courseId],
	);
}
