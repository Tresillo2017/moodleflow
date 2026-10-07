import { describe, expect, it } from "vitest";
import { relativeTime } from "./relative-time";

const NOW = new Date(2026, 9, 7, 12).getTime();
const DAY = 86_400_000;

describe("relativeTime", () => {
	it("picks the largest fitting unit, past and future", () => {
		expect(relativeTime(NOW - 30 * 60_000, NOW)).toBe("30 minutes ago");
		expect(relativeTime(NOW - 19 * DAY, NOW)).toBe("19 days ago");
		expect(relativeTime(NOW + 35 * DAY, NOW)).toBe("next month");
		expect(relativeTime(NOW + 70 * DAY, NOW)).toBe("in 2 months");
	});

	it("says just now under a minute", () => {
		expect(relativeTime(NOW - 5_000, NOW)).toBe("just now");
	});
});
