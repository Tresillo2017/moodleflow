import type { MoodleClient } from "./client";
import type {
	MoodleAssignment,
	MoodleCalendarEvent,
	MoodleCourse,
	MoodleCourseContent,
	MoodleCourseGrades,
	MoodleSiteInfo,
	MoodleUser,
} from "@/types/moodle";

const now = Date.now();
const days = (n: number) => new Date(now + n * 86_400_000).toISOString();

const courses: MoodleCourse[] = [
	{ id: 1, shortName: "MATH201", fullName: "Mathematics II", progress: 72, isFavourite: true, visible: true },
	{ id: 2, shortName: "PHYS101", fullName: "Physics Fundamentals", progress: 41, isFavourite: true, visible: true },
	{ id: 3, shortName: "HIST150", fullName: "Modern History", progress: 93, isFavourite: false, visible: true },
	{ id: 4, shortName: "CS210", fullName: "Data Structures", progress: 58, isFavourite: false, visible: true },
];

const assignments: MoodleAssignment[] = [
	{ id: 101, courseId: 1, courseName: "Mathematics II", name: "Problem Set 4", dueDate: days(1), status: "not_started" },
	{ id: 102, courseId: 2, courseName: "Physics Fundamentals", name: "Lab Report: Momentum", dueDate: days(4), status: "draft" },
	{ id: 103, courseId: 3, courseName: "Modern History", name: "Essay: Cold War", dueDate: days(7), status: "not_started" },
	{ id: 104, courseId: 4, courseName: "Data Structures", name: "Assignment: Binary Trees", dueDate: days(-2), status: "overdue" },
	{ id: 105, courseId: 1, courseName: "Mathematics II", name: "Problem Set 3", dueDate: days(-10), status: "graded", grade: 87, maxGrade: 100, feedback: "Solid work, watch your integration by parts steps." },
];

const calendarEvents: MoodleCalendarEvent[] = [
	{ id: 1, name: "Problem Set 4 due", courseId: 1, courseName: "Mathematics II", startDate: days(1), type: "assignment" },
	{ id: 2, name: "Physics Lecture", courseId: 2, courseName: "Physics Fundamentals", startDate: days(0.3), type: "course" },
	{ id: 3, name: "Quiz: Thermodynamics", courseId: 2, courseName: "Physics Fundamentals", startDate: days(5), type: "quiz" },
	{ id: 4, name: "Essay: Cold War due", courseId: 3, courseName: "Modern History", startDate: days(7), type: "assignment" },
];

const courseContents: Record<number, MoodleCourseContent> = {
	1: {
		courseId: 1,
		sections: [
			{
				id: 1,
				name: "Week 1",
				activities: [
					{ id: 1, courseId: 1, sectionId: 1, type: "resource", name: "Lecture notes", visible: true, completed: true },
					{ id: 2, courseId: 1, sectionId: 1, type: "url", name: "Video lecture", visible: true, completed: true },
					{ id: 3, courseId: 1, sectionId: 1, type: "quiz", name: "Quiz 1", visible: true, completed: true },
				],
			},
			{
				id: 2,
				name: "Week 2",
				activities: [
					{ id: 4, courseId: 1, sectionId: 2, type: "assignment", name: "Problem Set 4", dueDate: days(1), visible: true, completed: false },
					{ id: 5, courseId: 1, sectionId: 2, type: "forum", name: "Discussion: Series convergence", visible: true, completed: false },
				],
			},
		],
	},
};

const grades: MoodleCourseGrades[] = courses.map((c) => ({
	courseId: c.id,
	courseName: c.fullName,
	items: [
		{ id: c.id * 10 + 1, itemName: "Assignment 1", grade: 85, maxGrade: 100, percentage: 85, letterGrade: "A-" },
		{ id: c.id * 10 + 2, itemName: "Midterm", grade: 78, maxGrade: 100, percentage: 78, letterGrade: "B+" },
	],
	courseTotal: 81.5,
	courseMaxTotal: 100,
}));

const siteInfo: MoodleSiteInfo = {
	siteName: "Demo University",
	siteUrl: "https://demo.moodleflow.dev",
	userId: 1,
	username: "demo.student",
	fullName: "Tomas",
	release: "4.4",
	functions: [],
};

const user: MoodleUser = {
	id: 1,
	username: "demo.student",
	fullName: "Tomas",
};

function delay<T>(value: T, ms = 250): Promise<T> {
	return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function createMockMoodleClient(): MoodleClient {
	return {
		getSiteInfo: () => delay(siteInfo),
		getCurrentUser: () => delay(user),
		getCourses: () => delay(courses),
		getCourseContents: (courseId) =>
			delay(
				courseContents[courseId] ?? { courseId, sections: [] },
			),
		getCalendarEvents: () => delay(calendarEvents),
		getAssignments: () => delay(assignments),
		getGrades: (courseId) =>
			delay(courseId ? grades.filter((g) => g.courseId === courseId) : grades),
	};
}
