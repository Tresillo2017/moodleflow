import type { Contribution, ContributionLevel, RepoContribution } from "@/components/ui/github-activity";
import type { MoodleAssignment, MoodleCourse, MoodleCourseGrades } from "@/types/moodle";

const DAY_MS = 86_400_000;

/**
 * Moodle has no single "daily activity log" web service exposed by default,
 * so this approximates a contribution calendar from what MoodleFlow already
 * fetches: graded dates (grading activity) and past assignment due dates
 * (submission activity). It's a proxy, not a true access log.
 */
export function buildContributions(
	grades: MoodleCourseGrades[],
	assignments: MoodleAssignment[],
	weeks = 53,
): Contribution[] {
	const counts = new Map<string, number>();
	const bump = (iso?: string) => {
		if (!iso) return;
		const key = iso.slice(0, 10);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	};

	for (const course of grades) {
		for (const item of course.items) bump(item.gradedDate);
	}
	for (const a of assignments) {
		if (a.dueDate && new Date(a.dueDate).getTime() <= Date.now()) bump(a.dueDate);
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

export function buildTopCourses(
	courses: MoodleCourse[],
	grades: MoodleCourseGrades[],
	assignments: MoodleAssignment[],
	limit = 3,
): RepoContribution[] {
	const activity = new Map<number, number>();
	for (const course of grades) {
		activity.set(course.courseId, (activity.get(course.courseId) ?? 0) + course.items.length);
	}
	for (const a of assignments) {
		activity.set(a.courseId, (activity.get(a.courseId) ?? 0) + 1);
	}

	return [...activity.entries()]
		.sort(([, a], [, b]) => b - a)
		.slice(0, limit)
		.map(([courseId, count]) => {
			const course = courses.find((c) => c.id === courseId);
			return {
				name: course?.fullName ?? `Course ${courseId}`,
				count,
				href: `/courses/${courseId}`,
			};
		});
}
