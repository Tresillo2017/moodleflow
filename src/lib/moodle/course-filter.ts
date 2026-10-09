import type { MoodleCourse } from "@/types/moodle";

/** Moodle's own "in progress" classification when known; else guesses: not hidden by an admin/teacher and not past its end date. */
export function isCurrentCourse(course: MoodleCourse): boolean {
	if (course.inProgress !== undefined) return course.inProgress;
	if (!course.visible) return false;
	if (course.endDate && new Date(course.endDate).getTime() < Date.now()) return false;
	return true;
}
