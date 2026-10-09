import { describe, expect, it } from "vitest";
import {
	calendarExportUrl,
	createdEventId,
	normalizeAllowedEventTypes,
	normalizeCourseIds,
	normalizeMonthView,
	normalizeTimeline,
} from "./normalize-calendar";

describe("calendar", () => {
	it("flattens the month view, once per event, oldest first", () => {
		const day = (events: object[]) => ({ events });
		const multi = { id: 2, name: "Camp", timestart: 200, eventtype: "course" };
		const events = normalizeMonthView({
			weeks: [{ days: [day([multi, { id: 1, name: "Quiz", timestart: 100, modulename: "quiz", instance: 4 }]), day([multi])] }],
		});
		expect(events.map((e) => [e.id, e.type])).toEqual([[1, "quiz"], [2, "course"]]);
		expect(events[0].module).toEqual({ name: "quiz", instance: 4 });
	});

	it("reads allowed event types in both response shapes", () => {
		expect(normalizeAllowedEventTypes({ allowedeventtypes: ["user", "course"] })).toEqual(["user", "course"]);
		expect(normalizeAllowedEventTypes({ allowedeventtypes: { user: true, site: false, course: true } })).toEqual(["user", "course"]);
	});

	it("returns the created event id and throws Moodle's warning", () => {
		expect(createdEventId({ events: [{ id: 7 }], warnings: [] })).toBe(7);
		expect(() => createdEventId({ events: [], warnings: [{ message: "No permission" }] })).toThrow("No permission");
	});

	it("maps timeline events and only offers actionable actions", () => {
		const [a, b] = normalizeTimeline({
			events: [
				{ id: 2, name: "Late", timesort: 200, action: { actionable: false, name: "Add submission" }, course: { id: 3, fullname: "Math" } },
				{ id: 1, name: "Early", timesort: 100, action: { actionable: true, name: "Attempt quiz", url: "https://x/q" } },
			],
		});
		expect([a.id, a.actionLabel, a.actionUrl]).toEqual([1, "Attempt quiz", "https://x/q"]);
		expect([b.courseId, b.actionLabel]).toEqual([3, undefined]);
	});

	it("reads course ids from a list or a { courses } wrapper", () => {
		expect(normalizeCourseIds([{ id: 1 }, { id: 2 }])).toEqual([1, 2]);
		expect(normalizeCourseIds({ courses: [{ id: 5 }], nextoffset: 1 })).toEqual([5]);
	});

	it("builds the export URL on the site origin", () => {
		expect(calendarExportUrl("https://moodle.test/sub", 9, "abc")).toBe(
			"https://moodle.test/calendar/export_execute.php?userid=9&authtoken=abc&preset_what=all&preset_time=recentupcoming",
		);
	});
});
