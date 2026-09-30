"use client";

import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import type { Quiz } from "@/types/quiz";

/**
 * A quiz by instance id. With the course id (`?course=`) it's one call; without it, the user's courses are searched.
 * Resolves to null when no course has it.
 */
export function useQuiz(quizId: number, courseId: number | null) {
	const { client } = useMoodleConnection();
	return useMoodleQuery<Quiz | null>(
		client
			? async () => {
					const courseIds = courseId ? [courseId] : (await client.getCourses()).map((c) => c.id);
					for (const id of courseIds) {
						const found = await client.getQuiz(id, quizId);
						if (found) return found;
					}
					return null;
				}
			: null,
		[client, quizId, courseId],
	);
}
