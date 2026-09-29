import type { MoodleAssignment } from "@/types/moodle";

/** Nothing final is on file yet, and Moodle hasn't said editing is locked. */
export function canSubmit(a: MoodleAssignment): boolean {
	return (a.status === "not_started" || a.status === "draft" || a.status === "overdue") && a.canEdit !== false;
}

/** Submitted (or graded); the assignment no longer needs action from the student. */
export function isDone(a: MoodleAssignment): boolean {
	return a.status === "submitted" || a.status === "late" || a.status === "graded";
}

/** "1 day 2 hours", "8 mins 33 secs": the two largest non-zero units, like Moodle. */
export function formatDuration(ms: number): string {
	let secs = Math.max(0, Math.round(ms / 1000));
	const units: [string, number][] = [["day", 86_400], ["hour", 3_600], ["min", 60], ["sec", 1]];
	const parts: string[] = [];
	for (const [name, size] of units) {
		const n = Math.floor(secs / size);
		secs -= n * size;
		if (n > 0) parts.push(`${n} ${name}${n === 1 ? "" : "s"}`);
	}
	return parts.slice(0, 2).join(" ") || "0 secs";
}

export type TimingTone = "success" | "warning" | "danger" | "neutral";

/** The "Time remaining" line of Moodle's submission status table. */
export function submissionTiming(a: MoodleAssignment, now = Date.now()): { text: string; tone: TimingTone } | undefined {
	if (!a.dueDate) return undefined;
	const due = new Date(a.dueDate).getTime();
	const submitted = a.submission?.status === "submitted" && a.submission.timeModified;
	if (submitted) {
		const diff = due - new Date(a.submission!.timeModified!).getTime();
		return diff >= 0
			? { text: `Assignment was submitted ${formatDuration(diff)} early`, tone: "success" }
			: { text: `Assignment was submitted ${formatDuration(-diff)} late`, tone: "warning" };
	}
	return due >= now
		? { text: `${formatDuration(due - now)} remaining`, tone: due - now < 86_400_000 ? "warning" : "neutral" }
		: { text: `Assignment is overdue by ${formatDuration(now - due)}`, tone: "danger" };
}
