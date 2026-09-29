import { describe, expect, it } from "vitest";
import type { MoodleAssignment } from "@/types/moodle";
import { canSubmit, formatDuration, isDone, submissionTiming } from "./assignment";
import { normalizeActivityCompletion } from "./normalize";

const base: MoodleAssignment = { id: 1, courseId: 1, courseName: "C", name: "A", status: "not_started" };

describe("formatDuration", () => {
	it("keeps the two largest units", () => {
		expect(formatDuration(8 * 60_000 + 33_000)).toBe("8 mins 33 secs");
		expect(formatDuration(86_400_000 + 2 * 3_600_000 + 5_000)).toBe("1 day 2 hours");
		expect(formatDuration(1_000)).toBe("1 sec");
		expect(formatDuration(-5)).toBe("0 secs");
	});
});

describe("submissionTiming", () => {
	const due = "2026-01-10T12:00:00Z";
	const dueMs = new Date(due).getTime();

	it("reports early and late submissions", () => {
		const early = { ...base, dueDate: due, submission: { status: "submitted" as const, timeModified: "2026-01-10T11:51:27Z", files: [] } };
		expect(submissionTiming(early, dueMs)).toEqual({ text: "Assignment was submitted 8 mins 33 secs early", tone: "success" });
		const late = { ...early, submission: { ...early.submission, timeModified: "2026-01-10T13:00:00Z" } };
		expect(submissionTiming(late, dueMs)?.text).toBe("Assignment was submitted 1 hour late");
	});

	it("reports overdue only when nothing is submitted", () => {
		expect(submissionTiming({ ...base, dueDate: due }, dueMs + 3_600_000)).toEqual({ text: "Assignment is overdue by 1 hour", tone: "danger" });
		expect(submissionTiming({ ...base, dueDate: due }, dueMs - 2 * 86_400_000)?.text).toBe("2 days remaining");
		expect(submissionTiming(base)).toBeUndefined();
	});
});

describe("assignment predicates", () => {
	it("treats submitted, late and graded as done, and hides Submit for them", () => {
		for (const status of ["submitted", "late", "graded"] as const) {
			expect(isDone({ ...base, status })).toBe(true);
			expect(canSubmit({ ...base, status })).toBe(false);
		}
		expect(isDone({ ...base, status: "overdue" })).toBe(false);
		expect(canSubmit({ ...base, status: "overdue" })).toBe(true);
		expect(canSubmit({ ...base, status: "not_started", canEdit: false })).toBe(false);
	});
});

describe("normalizeActivityCompletion", () => {
	it("reads the rule description for a completed activity", () => {
		const raw = { statuses: [{ cmid: 7, state: 1, tracking: 2, details: [{ rulename: "completionsubmit", rulevalue: { status: 1, description: "Make a submission" } }] }] };
		expect(normalizeActivityCompletion(raw, 7)).toEqual({ done: true, label: "Make a submission" });
		expect(normalizeActivityCompletion(raw, 8)).toBeUndefined();
	});

	it("ignores activities without completion tracking", () => {
		expect(normalizeActivityCompletion({ statuses: [{ cmid: 7, state: 0, tracking: 0 }] }, 7)).toBeUndefined();
	});
});
