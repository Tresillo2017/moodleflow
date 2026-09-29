import type { MoodleCourse, MoodleCourseGrades, MoodleGradeItem } from "@/types/moodle";

export function itemPercent(item: MoodleGradeItem): number | undefined {
	if (item.percentage !== undefined) return item.percentage;
	if (item.grade === undefined || !item.maxGrade) return undefined;
	return (item.grade / item.maxGrade) * 100;
}

export function coursePercent(course: MoodleCourseGrades): number | undefined {
	if (course.courseTotal !== undefined && course.courseMaxTotal) {
		return (course.courseTotal / course.courseMaxTotal) * 100;
	}
	const percents = course.items.map(itemPercent).filter((p): p is number => p !== undefined);
	return percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : undefined;
}

/** Moodle's grade report has no course name for most sites, so take it from the course list. */
export function withCourseNames(grades: MoodleCourseGrades[], courses: MoodleCourse[]): MoodleCourseGrades[] {
	const names = new Map(courses.map((c) => [c.id, c.fullName]));
	return grades.map((g) => ({ ...g, courseName: g.courseName || names.get(g.courseId) || `Course ${g.courseId}` }));
}

export interface GradeSummary {
	overall?: number;
	best?: { course: MoodleCourseGrades; percent: number };
	worst?: { course: MoodleCourseGrades; percent: number };
	gradedCount: number;
	itemCount: number;
}

export function summarizeGrades(grades: MoodleCourseGrades[]): GradeSummary {
	const scored = grades
		.map((course) => ({ course, percent: coursePercent(course) }))
		.filter((c): c is { course: MoodleCourseGrades; percent: number } => c.percent !== undefined)
		.sort((a, b) => b.percent - a.percent);
	const items = grades.flatMap((g) => g.items);
	return {
		overall: scored.length ? scored.reduce((sum, c) => sum + c.percent, 0) / scored.length : undefined,
		best: scored[0],
		// with a single scored course there is no meaningful "needs attention"
		worst: scored.length > 1 ? scored.at(-1) : undefined,
		gradedCount: items.filter((i) => i.grade !== undefined).length,
		itemCount: items.length,
	};
}

export interface RecentGrade {
	item: MoodleGradeItem;
	courseId: number;
	courseName: string;
}

export function recentGrades(grades: MoodleCourseGrades[], limit = 6): RecentGrade[] {
	return grades
		.flatMap((g) => g.items.map((item) => ({ item, courseId: g.courseId, courseName: g.courseName })))
		.filter((r) => r.item.gradedDate && r.item.grade !== undefined)
		.sort((a, b) => b.item.gradedDate!.localeCompare(a.item.gradedDate!))
		.slice(0, limit);
}

export type GradeSort = "name" | "highest" | "lowest";

export function sortCourseGrades(grades: MoodleCourseGrades[], sort: GradeSort): MoodleCourseGrades[] {
	const byName = (a: MoodleCourseGrades, b: MoodleCourseGrades) => a.courseName.localeCompare(b.courseName);
	if (sort === "name") return [...grades].sort(byName);
	const dir = sort === "highest" ? -1 : 1;
	// courses without a grade always sink to the bottom
	return [...grades].sort((a, b) => {
		const [pa, pb] = [coursePercent(a), coursePercent(b)];
		if (pa === undefined || pb === undefined) return pa === pb ? byName(a, b) : pa === undefined ? 1 : -1;
		return (pa - pb) * dir || byName(a, b);
	});
}
