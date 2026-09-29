"use client";

import { useAssignments } from "@/hooks/use-assignments";
import { useMemo } from "react";
import { GitHubActivity } from "@/components/ui/github-activity";
import { buildContributions, buildTopCourses, collectActivity } from "@/lib/moodle/activity";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { Activity } from "lucide-react";

const ACCENT = "var(--color-primary)";

/**
 * Adapted from the GitHub-activity contribution heatmap: same grid/tooltip/footer-panel component,
 * fed from what the student did in Moodle (activities completed, work submitted, items graded).
 * Moodle has no daily access log via Web Services, so this is a proxy; see lib/moodle/activity.ts.
 */
export function MoodleActivityCard() {
	const { client } = useMoodleConnection();
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const grades = useMoodleQuery(client ? () => client.getGrades() : null, [client]);
	const assignments = useAssignments();

	// Past courses (ended or hidden) would drown out what's happening now.
	const active = useMemo(() => courses.data?.filter(isCurrentCourse), [courses.data]);
	const activeIds = useMemo(() => active?.map((c) => c.id) ?? [], [active]);
	const completions = useMoodleQuery(client && active ? () => client.getCompletionDates(activeIds) : null, [client, active]);

	const loading = courses.loading || grades.loading || assignments.loading || completions.loading;
	const error = courses.error ?? grades.error ?? assignments.error;

	const events = useMemo(() => {
		if (!active || !grades.data || !assignments.data) return [];
		const ids = new Set(activeIds);
		return collectActivity(
			completions.data ?? [],
			assignments.data.filter((a) => ids.has(a.courseId)),
			grades.data.filter((g) => ids.has(g.courseId)),
		);
	}, [active, activeIds, grades.data, assignments.data, completions.data]);

	const contributions = useMemo(() => buildContributions(events), [events]);
	const topCourses = useMemo(() => buildTopCourses(active ?? [], events), [active, events]);

	if (loading) return <ListSkeleton rows={1} />;
	if (error) return <ErrorState error={error} />;
	if (contributions.every((c) => c.count === 0)) {
		return <EmptyState icon={Activity} title="No activity yet" description="Completed activities, submissions and grades will show up here." />;
	}

	return (
		<GitHubActivity
			contributions={contributions}
			repos={topCourses}
			accent={ACCENT}
			unit="activities"
			label="Most active in:"
			className="w-full"
			// full-width like the other dashboard sections; the grid centers itself inside
			style={{ width: "100%" }}
		/>
	);
}
