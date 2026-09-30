import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, scaledGrade } from "./quiz-format";

describe("quiz formatting", () => {
	it("formats durations and countdowns", () => {
		expect(formatDuration(1800)).toBe("30 mins");
		expect(formatDuration(60)).toBe("1 min");
		expect(formatDuration(5400)).toBe("1 hour 30 mins");
		expect(formatDuration(7200)).toBe("2 hours");
		expect(formatClock(245)).toBe("4:05");
		expect(formatClock(3723)).toBe("1:02:03");
		expect(formatClock(0)).toBe("0:00");
	});

	it("scales marks to the quiz grade", () => {
		expect(scaledGrade(4.5, { sumGrades: 9, maxGrade: 10 })).toBe(5);
		expect(scaledGrade(1, { sumGrades: 0, maxGrade: 10 })).toBe(0);
	});
});
