"use client";

import { useAssignments } from "@/hooks/use-assignments";
import { useMemo } from "react";
import { GitHubActivity } from "@/components/ui/github-activity";
import { buildContributions, buildTopCourses } from "@/lib/moodle/activity";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { Activity } from "lucide-react";

const ACCENT = "var(--color-primary)";

/**
 * Adapted from the GitHub-activity contribution heatmap: same grid/tooltip/
 * footer-panel component, fed from Moodle grading + assignment-due activity
 * instead of GitHub push events (Moodle has no equivalent daily access log
 * exposed via Web Services, so this is a best-effort proxy — see
 * lib/moodle/activity.ts).
 */
export function MoodleActivityCard() {
	const { client } = useMoodleConnection();
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const grades = useMoodleQuery(client ? () => client.getGrades() : null, [client]);
	const assignments = useAssignments();

	const loading = courses.loading || grades.loading || assignments.loading;
	const error = courses.error ?? grades.error ?? assignments.error;

	// Past courses (ended or hidden) would drown out what's happening now.
	const current = useMemo(() => {
		if (!courses.data || !grades.data || !assignments.data) return undefined;
		const active = courses.data.filter(isCurrentCourse);
		const ids = new Set(active.map((c) => c.id));
		return {
			courses: active,
			grades: grades.data.filter((g) => ids.has(g.courseId)),
			assignments: assignments.data.filter((a) => ids.has(a.courseId)),
		};
	}, [courses.data, grades.data, assignments.data]);

	const contributions = useMemo(
		() => (current ? buildContributions(current.grades, current.assignments) : []),
		[current],
	);
	const topCourses = useMemo(
		() => (current ? buildTopCourses(current.courses, current.grades, current.assignments) : []),
		[current],
	);

	if (loading) return <ListSkeleton rows={1} />;
	if (error) return <ErrorState error={error} />;
	if (contributions.every((c) => c.count === 0)) {
		return <EmptyState icon={Activity} title="No activity yet" description="Graded work and past deadlines will show up here." />;
	}

	return (
		<GitHubActivity
			contributions={contributions}
			repos={topCourses}
			accent={ACCENT}
			unit="graded items"
			label="Most active in:"
			className="w-full"
			// full-width like the other dashboard sections; the grid centers itself inside
			style={{ width: "100%" }}
		/>
	);
}
