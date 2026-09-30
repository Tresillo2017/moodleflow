"use client";

import { useCallback, useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import type { Workshop } from "@/types/workshop";

/**
 * A workshop by instance id. With the course id (`?course=`) it's one call; without it, the user's courses are searched.
 * Resolves to null when no course has it.
 */
export function useWorkshop(workshopId: number, courseId: number | null) {
	const { client } = useMoodleConnection();
	return useMoodleQuery<Workshop | null>(
		client
			? async () => {
					const courseIds = courseId ? [courseId] : (await client.getCourses()).map((c) => c.id);
					for (const id of courseIds) {
						const found = (await client.getWorkshops(id)).find((w) => w.id === workshopId);
						if (found) return found;
					}
					return null;
				}
			: null,
		[client, workshopId, courseId],
	);
}

/** Bumps a counter to refetch queries that list it in their deps. */
export function useReload(): [number, () => void] {
	const [version, setVersion] = useState(0);
	return [version, useCallback(() => setVersion((v) => v + 1), [])];
}

/** Course participants' names by user id (workshop records only carry ids); empty when the site hides them. */
export function useParticipantNames(courseId: number | null): (userId: number) => string {
	const { client } = useMoodleConnection();
	const people = useMoodleQuery(client && courseId ? () => client.getParticipants(courseId).catch(() => []) : null, [client, courseId]);
	const names = new Map((people.data ?? []).map((p) => [p.id, p.fullName]));
	return (userId) => names.get(userId) ?? "A classmate";
}
