import type { MoodleClient } from "./client";
import { deriveSubmissionStatus } from "./normalize";
import type {
	AssignmentConfig,
	MoodleAssignment,
	MoodleCalendarEvent,
	MoodleComment,
	MoodleCourse,
	MoodleCourseContent,
	MoodleCourseGrades,
	MoodleNotification,
	MoodleSiteInfo,
	MoodleUser,
} from "@/types/moodle";

const now = Date.now();
const days = (n: number) => new Date(now + n * 86_400_000).toISOString();

const courses: MoodleCourse[] = [
	{ id: 1, shortName: "MATH201", fullName: "Mathematics II", imageUrl: "data:image/svg+xml;utf8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 400 120\'%3E%3Crect width=\'400\' height=\'120\' fill=\'%23234\'/%3E%3Ccircle cx=\'320\' cy=\'40\' r=\'60\' fill=\'%23e94\' opacity=\'.6\'/%3E%3C/svg%3E", progress: 72, isFavourite: true, visible: true },
	{ id: 2, shortName: "PHYS101", fullName: "Physics Fundamentals", progress: 41, isFavourite: true, visible: true },
	{ id: 3, shortName: "HIST150", fullName: "Modern History", progress: 93, isFavourite: false, visible: true },
	{ id: 4, shortName: "CS210", fullName: "Data Structures", progress: 58, isFavourite: false, visible: true },
	{ id: 5, shortName: "ARCH100", fullName: "Intro to Architecture", progress: 100, isFavourite: false, visible: true, endDate: new Date(now - 200 * 86_400_000).toISOString() },
];

const textAndFiles: AssignmentConfig = { acceptsText: true, acceptsFiles: true, maxFiles: 3, maxFileBytes: 10_485_760, requiresSubmitAction: false, requiresStatement: false };
const draftMode: AssignmentConfig = { ...textAndFiles, requiresSubmitAction: true, requiresStatement: true };

const assignments: MoodleAssignment[] = [
	{ id: 101, cmid: 1101, openDate: days(-5), completion: { done: false, label: "To do: Make a submission" }, courseId: 1, courseName: "Mathematics II", name: "Problem Set 4", dueDate: days(1), status: "not_started", config: textAndFiles, canEdit: true, maxGrade: 100,
		description: "<p>Solve problems <strong>1-8</strong> from chapter 4 and show your working.</p><ul><li>Use the ratio test where it applies</li><li>Justify every convergence claim</li></ul>",
		introFiles: [{ name: "problem-set-4.pdf", url: "data:text/plain,hello", size: 120_000, mimeType: "application/pdf" }] },
	{ id: 102, courseId: 2, courseName: "Physics Fundamentals", name: "Lab Report: Momentum", dueDate: days(4), status: "draft", config: draftMode, canEdit: true, maxGrade: 100,
		description: "<p>Write up the momentum lab using the template.</p>",
		submission: { status: "draft", timeModified: days(-1), text: "Draft intro paragraph.", files: [] } },
	{ id: 103, courseId: 3, courseName: "Modern History", name: "Essay: Cold War", dueDate: days(7), status: "not_started", config: textAndFiles, canEdit: true, maxGrade: 100, description: "<p>1500 words.</p>" },
	{ id: 104, courseId: 4, courseName: "Data Structures", name: "Assignment: Binary Trees", dueDate: days(-2), status: "overdue", config: textAndFiles, canEdit: true, maxGrade: 100, description: "<p>Implement insert, delete and traversal.</p>" },
	{ id: 105, courseId: 1, courseName: "Mathematics II", name: "Problem Set 3", dueDate: days(-10), status: "graded", config: textAndFiles, canEdit: false, grade: 87, maxGrade: 100, gradedDate: days(-6),
		feedback: "<p>Solid work, watch your integration by parts steps.</p>",
		submission: { status: "submitted", timeModified: days(-11), text: "See attached.", files: [{ name: "ps3.pdf", url: "data:text/plain,ps3", size: 88_000, mimeType: "application/pdf" }] } },
	{ id: 106, cmid: 1106, openDate: days(-12), completion: { done: true, label: "Make a submission" }, courseId: 2, courseName: "Physics Fundamentals", name: "Problem Set 2", dueDate: days(-3), status: "submitted", config: textAndFiles, canEdit: true, maxGrade: 100,
		submission: { id: 9106, status: "submitted", timeModified: days(-4), text: "Answers below.", files: [{ name: "answers.pdf", url: "data:text/plain,a", size: 45_000, mimeType: "application/pdf" }] } },
	{ id: 107, courseId: 3, courseName: "Modern History", name: "Reading Response", dueDate: days(-5), status: "late", config: textAndFiles, canEdit: true, maxGrade: 100,
		submission: { status: "submitted", timeModified: days(-4), text: "Late response.", files: [] } },
];

const mockComments: Record<number, MoodleComment[]> = {};

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
				summary: "<p>Sequences, series and the ratio test. Read the notes <strong>before</strong> the Thursday lecture.</p>",
				activities: [
					{ id: 10, courseId: 1, sectionId: 1, type: "label", name: "Welcome to the course", description: "<h4>Welcome</h4><p>Everything for the first week lives here. Office hours are on <em>Tuesdays</em>.</p>", visible: true },
					{ id: 1, courseId: 1, sectionId: 1, type: "resource", name: "Lecture notes", visible: true, completed: true, files: [
						{ name: "lecture-1.pdf", url: "data:application/pdf;base64,JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzAwIDEwMF0vQ29udGVudHMgNCAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDUgMCBSPj4+Pj4+ZW5kb2JqCjQgMCBvYmo8PC9MZW5ndGggNDQ+PnN0cmVhbQpCVCAvRjEgMTggVGYgMjAgNTAgVGQgKERlbW8gbGVjdHVyZSkgVGogRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj5lbmRvYmoKdHJhaWxlcjw8L1Jvb3QgMSAwIFI+PgolJUVPRg==", size: 482_000, mimeType: "application/pdf" },
						{ name: "series.py", url: "data:text/plain,def%20partial_sum(n)%3A%0A%20%20%20%20return%20sum(1%20%2F%20k**2%20for%20k%20in%20range(1%2C%20n%20%2B%201))%0A", size: 74 },
					] },
					{ id: 2, courseId: 1, sectionId: 1, type: "url", name: "Video lecture", visible: true, completed: true },
					{ id: 3, courseId: 1, sectionId: 1, type: "quiz", name: "Quiz 1", description: "<p>Ten questions, two attempts allowed.</p>", visible: true, completed: true },
				],
			},
			{
				id: 2,
				name: "Week 2",
				activities: [
					{ id: 4, instance: 101, courseId: 1, sectionId: 2, type: "assignment", name: "Problem Set 4", dueDate: days(1), visible: true, completed: false },
					{ id: 5, instance: 1, courseId: 1, sectionId: 2, type: "forum", name: "Discussion: Series convergence", visible: true, completed: false },
				],
			},
			{
				id: 3,
				name: "Week 3",
				activities: [
					{ id: 6, courseId: 1, sectionId: 3, type: "resource", name: "Reading: Power series", visible: true, completed: false },
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

/** A year of graded-item history, biased toward weekdays and term time, so demo mode's activity heatmap looks lived-in. */
function seededActivityGrades(): MoodleCourseGrades[] {
	let seed = 42;
	const rand = () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x7fffffff;
	};

	return courses.map((c) => {
		const items = Array.from({ length: 45 }, (_, i) => {
			const daysAgo = Math.floor(rand() * 364);
			const date = new Date(now - daysAgo * 86_400_000);
			const isWeekend = date.getDay() === 0 || date.getDay() === 6;
			// term breaks: skip most of a ~3-week window around 100 and 250 days ago
			const inBreak = (daysAgo > 95 && daysAgo < 116) || (daysAgo > 245 && daysAgo < 266);
			if ((isWeekend && rand() > 0.3) || (inBreak && rand() > 0.15)) return null;
			return {
				id: c.id * 1000 + i,
				itemName: `Activity ${i + 1}`,
				grade: Math.round(60 + rand() * 40),
				maxGrade: 100,
				gradedDate: date.toISOString(),
			};
		}).filter((item): item is NonNullable<typeof item> => item !== null);

		return { courseId: c.id, courseName: c.fullName, items, courseTotal: 81.5, courseMaxTotal: 100 };
	});
}

const activityGrades = seededActivityGrades();
const gradesWithHistory: MoodleCourseGrades[] = grades.map((course) => ({
	...course,
	items: [...course.items, ...(activityGrades.find((g) => g.courseId === course.courseId)?.items ?? [])],
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

const notifications: MoodleNotification[] = [
	{ id: 1, subject: "Problem Set 4 has been posted", read: false, timeCreated: days(-0.5), courseId: 1 },
	{ id: 2, subject: "New grade: Problem Set 3", body: "You scored 87/100.", read: false, timeCreated: days(-2) },
	{ id: 3, subject: "Physics Lecture starting soon", read: true, timeCreated: days(-3), courseId: 2 },
];

function delay<T>(value: T, ms = 250): Promise<T> {
	return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function createMockMoodleClient(): MoodleClient {
	return {
		getSiteInfo: () => delay(siteInfo),
		getSiteConfig: () => delay({ siteName: siteInfo.siteName, maxUploadBytes: 10_485_760, registrationEnabled: false }),
		supports: () => true,
		logActivityView: () => delay(true, 0),
		logCourseView: () => delay(true, 0),
		uploadFiles: async (_files, opts) => {
			for (const step of [0.3, 0.7, 1]) {
				await delay(undefined, 120);
				opts?.onProgress?.(step);
			}
			return 1;
		},
		getCurrentUser: () => delay(user),
		getCourses: () => delay(courses),
		setCourseFavourite: (courseId, favourite) => {
			const course = courses.find((c) => c.id === courseId);
			if (course) course.isFavourite = favourite;
			return delay(undefined);
		},
		getCourseContents: (courseId) =>
			delay(
				courseContents[courseId] ?? { courseId, sections: [] },
			),
		getCalendarEvents: () => delay(calendarEvents),
		getAssignments: () => delay(assignments),
		getAssignment: (id) => delay(assignments.find((a) => a.id === id)),
		saveAssignmentSubmission: (assignment, input) => {
			const target = assignments.find((a) => a.id === assignment.id);
			if (target) {
				const files = (input.files ?? target.submission?.files ?? []).map((f) =>
					f instanceof File ? { name: f.name, url: "data:text/plain,", size: f.size, mimeType: f.type } : f,
				);
				const submitted = !target.config?.requiresSubmitAction;
				target.submission = { status: submitted ? "submitted" : "draft", timeModified: new Date().toISOString(), text: input.text ?? target.submission?.text, files };
				target.status = deriveSubmissionStatus({ submissionStatus: target.submission.status, graded: false, dueDate: target.dueDate, submittedAt: target.submission.timeModified });
			}
			return delay(undefined);
		},
		removeAssignmentSubmission: (id) => {
			const target = assignments.find((a) => a.id === id);
			if (target) {
				target.submission = undefined;
				target.status = deriveSubmissionStatus({ graded: false, dueDate: target.dueDate });
			}
			return delay(undefined);
		},
		getSubmissionComments: (a) => delay(mockComments[a.id] ?? []),
		addSubmissionComment: (a, content) => {
			(mockComments[a.id] ??= []).push({ id: Date.now(), author: "Tomas", content: `<p>${content.replace(/</g, "&lt;")}</p>`, time: new Date().toISOString() });
			return delay(undefined);
		},
		submitAssignmentForGrading: (id) => {
			const target = assignments.find((a) => a.id === id);
			if (target?.submission) {
				target.submission = { ...target.submission, status: "submitted", timeModified: new Date().toISOString() };
				target.status = deriveSubmissionStatus({ submissionStatus: "submitted", graded: false, dueDate: target.dueDate, submittedAt: target.submission.timeModified });
			}
			return delay(undefined);
		},
		getGrades: (courseId) =>
			delay(courseId ? gradesWithHistory.filter((g) => g.courseId === courseId) : gradesWithHistory),
		getForumDiscussions: () =>
			delay([
				{ id: 1, subject: "Does the ratio test always work?", author: "Ana Costa", timeModified: days(-1), replies: 4, pinned: false },
				{ id: 2, subject: "Welcome to the course", author: "Prof. Silva", timeModified: days(-20), replies: 0, pinned: true },
			]),
		fileUrl: (url) => url,
		getNotifications: () => delay(notifications),
		markNotificationRead: (notificationId) => {
			const n = notifications.find((n) => n.id === notificationId);
			if (n) n.read = true;
			return delay(undefined);
		},
		markAllNotificationsRead: () => {
			for (const n of notifications) n.read = true;
			return delay(undefined);
		},
	};
}
