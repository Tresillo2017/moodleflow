import type { Contribution, ContributionLevel, RepoContribution } from "@/components/ui/github-activity";
import type { MoodleAssignment, MoodleCourse, MoodleCourseGrades } from "@/types/moodle";

const DAY_MS = 86_400_000;

export interface ActivityEvent {
	courseId: number;
	/** ISO timestamp */
	date: string;
}

/**
 * Moodle exposes no daily access log through web services, so "activity" is what the student
 * demonstrably did: activities completed, work submitted and items that got graded.
 */
export function collectActivity(
	completions: ActivityEvent[],
	assignments: MoodleAssignment[],
	grades: MoodleCourseGrades[],
): ActivityEvent[] {
	const events = [...completions];
	for (const a of assignments) {
		if (a.submission?.timeModified) events.push({ courseId: a.courseId, date: a.submission.timeModified });
	}
	for (const course of grades) {
		for (const item of course.items) {
			if (item.gradedDate) events.push({ courseId: course.courseId, date: item.gradedDate });
		}
	}
	return events;
}

export function buildContributions(events: ActivityEvent[], weeks = 53): Contribution[] {
	const counts = new Map<string, number>();
	for (const e of events) {
		const key = e.date.slice(0, 10);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	const max = Math.max(1, ...counts.values());
	const levelOf = (count: number): ContributionLevel => {
		if (count === 0) return 0;
		const ratio = count / max;
		if (ratio > 0.75) return 4;
		if (ratio > 0.5) return 3;
		if (ratio > 0.25) return 2;
		return 1;
	};

	const today = new Date();
	const days = weeks * 7;
	// align the window to end on a Saturday so full weeks render as clean columns
	const alignedEnd = new Date(today);
	alignedEnd.setDate(alignedEnd.getDate() + (6 - alignedEnd.getDay()));

	return Array.from({ length: days }, (_, i) => {
		const date = new Date(alignedEnd.getTime() - (days - 1 - i) * DAY_MS);
		const key = date.toISOString().slice(0, 10);
		const count = counts.get(key) ?? 0;
		return { date: key, count, level: levelOf(count) };
	});
}

export function buildTopCourses(courses: MoodleCourse[], events: ActivityEvent[], limit = 3): RepoContribution[] {
	const activity = new Map<number, number>();
	for (const e of events) activity.set(e.courseId, (activity.get(e.courseId) ?? 0) + 1);

	return [...activity.entries()]
		.sort(([, a], [, b]) => b - a)
		.slice(0, limit)
		.map(([courseId, count]) => ({
			name: courses.find((c) => c.id === courseId)?.fullName ?? `Course ${courseId}`,
			count,
			href: `/courses/${courseId}`,
		}));
}
