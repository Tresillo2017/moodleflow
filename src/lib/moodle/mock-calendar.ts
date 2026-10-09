import type { CalendarApi } from "./client-calendar";
import type { RecentItem, TimelineEvent } from "@/types/calendar";
import type { MoodleCalendarEvent } from "@/types/moodle";

const wait = <T>(value: T, ms = 150): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const DAY = 86_400_000;
const at = (days: number, hour = 9) => {
	const d = new Date(Date.now() + days * DAY);
	d.setHours(hour, 0, 0, 0);
	return d.toISOString();
};

const COURSES: Record<number, string> = { 1: "Mathematics II", 2: "Physics Fundamentals", 3: "Modern History" };

const events: MoodleCalendarEvent[] = [
	{ id: 1, name: "Problem Set 4 due", courseId: 1, courseName: COURSES[1], startDate: at(1, 23), type: "assignment", module: { name: "assign", instance: 101 } },
	{ id: 2, name: "Physics Lecture", courseId: 2, courseName: COURSES[2], startDate: at(0, 14), type: "course" },
	{ id: 3, name: "Quiz: Thermodynamics", courseId: 2, courseName: COURSES[2], startDate: at(5, 10), type: "quiz", module: { name: "quiz", instance: 1 } },
	{ id: 4, name: "Essay: Cold War due", courseId: 3, courseName: COURSES[3], startDate: at(7, 23), type: "assignment", module: { name: "assign", instance: 102 } },
	{ id: 5, name: "Study group", startDate: at(2, 18), type: "personal", canEdit: true, canDelete: true },
	{ id: 6, name: "Midterm review", courseId: 1, courseName: COURSES[1], startDate: at(-3, 16), type: "course" },
];
let nextId = 100;

/** The next events from now on, for the legacy upcoming list. */
export const upcomingMockEvents = () => events.filter((e) => e.startDate >= new Date().toISOString());

const timeline = (): TimelineEvent[] =>
	events
		.filter((e) => e.type === "assignment" || e.type === "quiz")
		.map((e) => ({
			id: e.id,
			name: e.name,
			courseId: e.courseId,
			courseName: e.courseName,
			date: e.startDate,
			actionLabel: e.type === "quiz" ? "Attempt quiz" : "Add submission",
			module: e.module,
		}));

const recentItems: RecentItem[] = [
	{ id: 1, cmid: 1101, courseId: 1, courseName: COURSES[1], module: "assign", name: "Problem Set 4", accessedAt: at(0, 8) },
	{ id: 2, cmid: 2201, courseId: 2, courseName: COURSES[2], module: "quiz", name: "Thermodynamics quiz", accessedAt: at(-1, 17) },
	{ id: 3, cmid: 1102, courseId: 1, courseName: COURSES[1], module: "resource", name: "Lecture notes", accessedAt: at(-2, 11) },
];

const hidden = new Set<number>();
const ALL_COURSES = [1, 2, 3, 4, 5];
const STARRED = [1, 2];
const FUTURE: number[] = [];
const PAST = [5];

export function createMockCalendarApi(): CalendarApi {
	return {
		getCalendarMonth: (year, month) =>
			wait(events.filter((e) => { const d = new Date(e.startDate); return d.getFullYear() === year && d.getMonth() + 1 === month; }).sort((a, b) => a.startDate.localeCompare(b.startDate))),
		getAllowedEventTypes: () => wait(["user", "course"]),
		createCalendarEvent: (input) => {
			const id = nextId++;
			events.push({ id, name: input.name, description: input.description, courseId: input.courseId, courseName: input.courseId ? COURSES[input.courseId] : undefined, startDate: input.start, type: input.scope === "course" ? "course" : "personal", canEdit: true, canDelete: true });
			return wait(id);
		},
		deleteCalendarEvent: (id) => {
			const i = events.findIndex((e) => e.id === id);
			if (i >= 0) events.splice(i, 1);
			return wait(undefined);
		},
		moveCalendarEvent: (id, day) => {
			const e = events.find((x) => x.id === id);
			if (e) {
				const from = new Date(e.startDate);
				const to = new Date(day);
				from.setFullYear(to.getFullYear(), to.getMonth(), to.getDate());
				e.startDate = from.toISOString();
			}
			return wait(undefined);
		},
		getCalendarExportUrl: () => wait("https://moodle.example.edu/calendar/export_execute.php?userid=1&authtoken=demo&preset_what=all&preset_time=recentupcoming"),
		getTimeline: (from, to) => wait(timeline().filter((e) => e.date >= from && e.date <= to && !hidden.has(e.courseId ?? 0)).sort((a, b) => a.date.localeCompare(b.date))),
		getRecentCourseIds: () => wait([1, 2]),
		getRecentItems: () => wait(recentItems),
		getCourseIdsByClassification: (c) =>
			wait(
				c === "hidden" ? [...hidden]
				: c === "favourites" ? STARRED.filter((id) => !hidden.has(id))
				: c === "future" ? FUTURE
				: c === "past" ? PAST
				: c === "inprogress" ? ALL_COURSES.filter((id) => !PAST.includes(id) && !hidden.has(id))
				: ALL_COURSES.filter((id) => !hidden.has(id)),
			),
		setCourseHidden: (id, value) => {
			if (value) hidden.add(id);
			else hidden.delete(id);
			return wait(undefined, 80);
		},
		getDashboardBlocks: () => wait([{ id: 20, name: "html", title: "Welcome", html: "<p>Library hours: 8:00 to 22:00 on weekdays.</p>" }]),
		logDashboardView: () => wait(undefined, 0),
	};
}
