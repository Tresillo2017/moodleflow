import { describe, expect, it } from "vitest";
import { buildContributions, buildTopCourses, collectActivity } from "./activity";
import type { MoodleAssignment, MoodleCourse, MoodleCourseGrades } from "@/types/moodle";

const today = new Date().toISOString();

describe("activity", () => {
	it("combines completions, submissions and grades, then counts per day and course", () => {
		const events = collectActivity(
			[{ courseId: 1, date: today }],
			[{ courseId: 1, submission: { status: "submitted", timeModified: today, files: [] } } as unknown as MoodleAssignment, { courseId: 2 } as MoodleAssignment],
			[{ courseId: 2, items: [{ gradedDate: today }] } as unknown as MoodleCourseGrades],
		);
		expect(events).toHaveLength(3);
		const todayCell = buildContributions(events).find((d) => d.date === today.slice(0, 10));
		expect(todayCell).toMatchObject({ count: 3, level: 4 });
		const top = buildTopCourses([{ id: 1, fullName: "Math" } as MoodleCourse], events);
		expect(top[0]).toEqual({ name: "Math", count: 2, href: "/courses/1" });
	});
});
