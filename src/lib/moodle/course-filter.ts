import type { MoodleCourse } from "@/types/moodle";

/** Excludes courses hidden by an admin/teacher or past their end date (previous academic years). */
export function isCurrentCourse(course: MoodleCourse): boolean {
	if (!course.visible) return false;
	if (course.endDate && new Date(course.endDate).getTime() < Date.now()) return false;
	return true;
}
