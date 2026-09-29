import type { MoodleCourseGrades } from "@/types/moodle";

export interface GradeTrendPoint {
	week: string;
	average: number;
}

/** Weekly average percentage across all graded items with a known date, for a trend chart. */
export function buildGradeTrend(grades: MoodleCourseGrades[]): GradeTrendPoint[] {
	const buckets = new Map<string, { total: number; count: number }>();

	for (const course of grades) {
		for (const item of course.items) {
			if (!item.gradedDate || item.grade === undefined || !item.maxGrade) continue;
			const date = new Date(item.gradedDate);
			const weekStart = new Date(date);
			weekStart.setDate(date.getDate() - date.getDay());
			const key = weekStart.toISOString().slice(0, 10);
			const percentage = (item.grade / item.maxGrade) * 100;
			const bucket = buckets.get(key) ?? { total: 0, count: 0 };
			buckets.set(key, { total: bucket.total + percentage, count: bucket.count + 1 });
		}
	}

	return [...buckets.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([week, { total, count }]) => ({ week, average: Math.round(total / count) }));
}
