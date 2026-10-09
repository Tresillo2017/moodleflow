import { describe, expect, it } from "vitest";
import { isCurrentCourse } from "./course-filter";
import type { MoodleCourse } from "@/types/moodle";

const course = (over: Partial<MoodleCourse>): MoodleCourse => ({ id: 1, shortName: "C", fullName: "Course", visible: true, ...over });

describe("isCurrentCourse", () => {
	it("trusts Moodle's classification when present", () => {
		expect(isCurrentCourse(course({ inProgress: true, visible: false }))).toBe(true);
		expect(isCurrentCourse(course({ inProgress: false }))).toBe(false);
	});

	it("guesses from visibility and end date otherwise", () => {
		expect(isCurrentCourse(course({}))).toBe(true);
		expect(isCurrentCourse(course({ visible: false }))).toBe(false);
		expect(isCurrentCourse(course({ endDate: "2000-01-01T00:00:00Z" }))).toBe(false);
	});
});
