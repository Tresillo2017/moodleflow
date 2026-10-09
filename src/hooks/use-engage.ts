"use client";

import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import type { MoodleClient } from "@/lib/moodle/client";
import type { Choice, Feedback, Survey } from "@/types/engage";
import type { Wiki } from "@/types/wiki";

type Lister<T> = (courseId: number) => Promise<T[]>;

/**
 * An activity by instance id. With the course id (`?course=`) it's one call; without it, the user's courses are searched.
 * Resolves to null when no course has it.
 */
function useCourseActivity<T extends { id: number }>(pick: (client: MoodleClient) => Lister<T>, id: number, courseId: number | null) {
	const { client } = useMoodleConnection();
	return useMoodleQuery<T | null>(
		client
			? async () => {
					const list = pick(client);
					const courseIds = courseId ? [courseId] : (await client.getCourses()).map((c) => c.id);
					for (const cid of courseIds) {
						const found = (await list(cid)).find((x) => x.id === id);
						if (found) return found;
					}
					return null;
				}
			: null,
		[client, id, courseId],
	);
}

export const useChoice = (id: number, courseId: number | null) => useCourseActivity<Choice>((c) => c.getChoices, id, courseId);
export const useFeedback = (id: number, courseId: number | null) => useCourseActivity<Feedback>((c) => c.getFeedbacks, id, courseId);
export const useSurvey = (id: number, courseId: number | null) => useCourseActivity<Survey>((c) => c.getSurveys, id, courseId);
export const useWiki = (id: number, courseId: number | null) => useCourseActivity<Wiki>((c) => c.getWikis, id, courseId);
