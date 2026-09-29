"use client";

import { useMemo } from "react";
import { GitHubActivity } from "@/components/ui/github-activity";
import { buildContributions, buildTopCourses } from "@/lib/moodle/activity";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
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
	const assignments = useMoodleQuery(client ? () => client.getAssignments() : null, [client]);

	const loading = courses.loading || grades.loading || assignments.loading;
	const error = courses.error ?? grades.error ?? assignments.error;

	const contributions = useMemo(
		() => (grades.data && assignments.data ? buildContributions(grades.data, assignments.data) : []),
		[grades.data, assignments.data],
	);
	const topCourses = useMemo(
		() =>
			courses.data && grades.data && assignments.data
				? buildTopCourses(courses.data, grades.data, assignments.data)
				: [],
		[courses.data, grades.data, assignments.data],
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
