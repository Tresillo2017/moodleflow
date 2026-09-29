"use client";

import { useMemo } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { isCurrentCourse } from "@/lib/moodle/course-filter";

/** Assignments of the current courses only, with real submission status (one status call per assignment). */
export function useAssignments() {
	const { client } = useMoodleConnection();
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const courseIds = useMemo(() => courses.data?.filter(isCurrentCourse).map((c) => c.id), [courses.data]);
	const assignments = useMoodleQuery(
		client && courseIds ? () => client.getAssignments(courseIds) : null,
		[client, courseIds],
	);
	return {
		...assignments,
		loading: courses.loading || assignments.loading,
		error: courses.error ?? assignments.error,
	};
}
