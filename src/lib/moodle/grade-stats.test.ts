import { describe, expect, it } from "vitest";
import { recentGrades, sortCourseGrades, summarizeGrades, withCourseNames } from "./grade-stats";
import type { MoodleCourse, MoodleCourseGrades } from "@/types/moodle";

const course = (courseId: number, courseName: string, total?: number, items: MoodleCourseGrades["items"] = []): MoodleCourseGrades => ({
	courseId,
	courseName,
	items,
	courseTotal: total,
	courseMaxTotal: total === undefined ? undefined : 100,
});

describe("grade stats", () => {
	it("fills missing course names from the course list", () => {
		const named = withCourseNames([course(1, ""), course(2, "Kept"), course(3, "")], [{ id: 1, fullName: "Maths" } as MoodleCourse]);
		expect(named.map((g) => g.courseName)).toEqual(["Maths", "Kept", "Course 3"]);
	});

	it("summarizes overall, best and worst, ignoring ungraded courses", () => {
		const s = summarizeGrades([course(1, "A", 90), course(2, "B", 60), course(3, "C")]);
		expect(s.overall).toBe(75);
		expect(s.best?.course.courseId).toBe(1);
		expect(s.worst?.course.courseId).toBe(2);
		expect(summarizeGrades([course(1, "A", 90)]).worst).toBeUndefined();
	});

	it("lists the newest graded items first", () => {
		const items = [
			{ id: 1, itemName: "old", grade: 1, gradedDate: "2026-01-01T00:00:00Z" },
			{ id: 2, itemName: "new", grade: 1, gradedDate: "2026-03-01T00:00:00Z" },
			{ id: 3, itemName: "ungraded" },
		];
		expect(recentGrades([course(1, "A", 50, items)]).map((r) => r.item.itemName)).toEqual(["new", "old"]);
	});

	it("sorts by grade with ungraded courses last", () => {
		const grades = [course(1, "A"), course(2, "B", 40), course(3, "C", 80)];
		expect(sortCourseGrades(grades, "highest").map((g) => g.courseId)).toEqual([3, 2, 1]);
		expect(sortCourseGrades(grades, "lowest").map((g) => g.courseId)).toEqual([2, 3, 1]);
	});
});
