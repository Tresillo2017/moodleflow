import type { MoodleAssignment } from "@/types/moodle";

/** Nothing final is on file yet, and Moodle hasn't said editing is locked. */
export function canSubmit(a: MoodleAssignment): boolean {
	return (a.status === "not_started" || a.status === "draft" || a.status === "overdue") && a.canEdit !== false;
}

/** Submitted (or graded); the assignment no longer needs action from the student. */
export function isDone(a: MoodleAssignment): boolean {
	return a.status === "submitted" || a.status === "late" || a.status === "graded";
}
