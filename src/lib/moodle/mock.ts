import type { MoodleClient } from "./client";
import { deriveSubmissionStatus } from "./normalize";
import { createMockSocialApi } from "./mock-social";
import { createMockQuizApi } from "./mock-quiz";
import { createMockLessonApi } from "./mock-lesson";
import { createMockWorkshopApi } from "./mock-workshop";
import { createMockEngageApi } from "./mock-engage";
import { createMockWikiApi } from "./mock-wiki";
import { createMockGlossaryApi } from "./mock-glossary";
import { createMockDatabaseApi } from "./mock-database";
import { createMockEmbedApi } from "./mock-embed";
import type {
	AssignmentConfig,
	MoodleAssignment,
	MoodleCalendarEvent,
	MoodleComment,
	MoodleCourse,
	MoodleCourseContent,
	MoodleCourseGrades,
	MoodleNotification,
	MoodleParticipant,
	CourseCompletion,
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
					{ id: 2, courseId: 1, sectionId: 1, type: "url", name: "Video lecture", externalUrl: "https://example.com/lecture", visible: true, completed: true },
					{ id: 11, instance: 11, courseId: 1, sectionId: 1, type: "page", name: "Course rules", visible: true, manualCompletion: true, completed: false,
						files: [{ name: "index.html", url: "data:text/html,%3Ch3%3EGround%20rules%3C%2Fh3%3E%3Cp%3EBe%20on%20time.%20Ask%20questions.%3C%2Fp%3E", size: 80 }] },
					{ id: 12, instance: 12, courseId: 1, sectionId: 1, type: "folder", name: "Past exams", visible: true, files: [
						{ name: "2023.md", path: "/2023/", url: "data:text/markdown,%23%20Exam%202023%0A-%20Q1%0A-%20Q2", size: 30 },
						{ name: "grades.csv", path: "/2023/", url: "data:text/csv,name%2Cscore%0AAna%2C9%0A%22Costa%2C%20J%22%2C8", size: 30 },
						{ name: "syllabus.docx", url: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBBQAAAAIAFehPV3MVIwQ4QAAAJwBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2QTU7DMBCFr2J5i2KHLhBCSbqAsgQW5QCWM0ks7BnLMw3h9iht6QIV1u/ne3rNdklRzVA4ELb61tRaAXrqA46tft8/V/d62zX7rwyslhSRWz2J5Adr2U+QHBvKgEuKA5XkhA2V0WbnP9wIdlPXd9YTCqBUsnbornmCwR2iqN0igCdsgchaPZ6MK6vVLucYvJNAaGfsf1GqM8EUiEcPTyHzzZKitlcJq/I34Jx7naGU0IN6c0VeXIJW208qve3JHxKgmP9rruykYQgeLvm1LRfywBxwTNFclOQC/uy3x7u7b1BLAwQUAAAACABXoT1dNlfe3KQAAAAYAQAACwAAAF9yZWxzLy5yZWxzjc+xCsIwFAXQXwlvN2kdRKRpFxG6Sv2AkLy2wSQvJFHr37s4WHFwvVzO5Tbd4h27Y8qWgoSaV8AwaDI2TBIuw2mzh65tzuhUsRTybGNmi3chS5hLiQchsp7Rq8wpYli8Gyl5VTKnNImo9FVNKLZVtRPp04C1yXojIfWmBjY8I/5j0zhajUfSN4+h/Jj4agAbVJqwSHhQMsK8Y754B6JtxOpi+wJQSwMEFAAAAAgAV6E9XWF6jwziAAAAfAEAABEAAAB3b3JkL2RvY3VtZW50LnhtbG1QTWvDMAz9K8b3xekOZYTEvY31MCh0Y2fH0dKAbRlLzce/H07WjkEvTwg9vfek+jB7J0ZINGBo5K4opYBgsRtC38jPj9enF3nQ9VR1aK8eAovZu0DV1MgLc6yUInsBb6jACGH27huTN0wFpl5NmLqY0ALREHrv1HNZ7pU3Q5BZssVuyTWucEprOfPiQEzVaFwj38DkIDupdK3unBVYnxfnTHulPOF1njbWXXMj5sQVRWOhkTEBQRpB6i9wFj0IRvFP4AabVbsZ/3as3w3na3mwJI7HR4usiweB1O1a9fdJ/QNQSwECFAMUAAAACABXoT1dzFSMEOEAAACcAQAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAxQAAAAIAFehPV02V97cpAAAABgBAAALAAAAAAAAAAAAAACAARIBAABfcmVscy8ucmVsc1BLAQIUAxQAAAAIAFehPV1heo8M4gAAAHwBAAARAAAAAAAAAAAAAACAAd8BAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAwADALkAAADwAgAAAAA=", size: 1200 },
					] },
					{ id: 13, instance: 13, courseId: 1, sectionId: 1, type: "book", name: "Study guide", visible: true,
						chapters: [{ title: "Limits", href: "1/index.html", level: 0 }, { title: "Epsilon-delta", href: "2/index.html", level: 1 }, { title: "Series", href: "3/index.html", level: 0 }],
						files: [
							{ name: "index.html", path: "/1/", url: "data:text/html,%3Ch2%3ELimits%3C%2Fh2%3E%3Cp%3EA%20limit%20describes%20behaviour%20near%20a%20point.%3C%2Fp%3E%3C%21--/1/index.html--%3E", size: 90 },
							{ name: "index.html", path: "/2/", url: "data:text/html,%3Ch3%3EEpsilon-delta%3C%2Fh3%3E%3Cp%3EFor%20every%20e%3E0...%3C%2Fp%3E%3C%21--/2/index.html--%3E", size: 90 },
							{ name: "index.html", path: "/3/", url: "data:text/html,%3Ch2%3ESeries%3C%2Fh2%3E%3Cp%3ESums%20of%20sequences.%3C%2Fp%3E%3C%21--/3/index.html--%3E", size: 90 },
						] },
					{ id: 15, instance: 15, courseId: 1, sectionId: 1, type: "imscp", name: "Interactive lesson package", visible: true,
						chapters: [{ title: "Intro", href: "intro.html", level: 0 }],
						files: [{ name: "intro.html", url: "data:text/html,%3Ch2%3EPackage%20intro%3C%2Fh2%3E%3Cp%3EContent%20from%20an%20IMS%20package.%3C%2Fp%3E", size: 70 }] },
					{ id: 14, courseId: 1, sectionId: 1, type: "quiz", name: "Final review (locked)", locked: true, availabilityInfo: "<p>Available from <strong>1 December</strong></p>", visible: true },
					{ id: 3, courseId: 1, sectionId: 1, type: "quiz", name: "Quiz 1", description: "<p>Ten questions, two attempts allowed.</p>", visible: true, completed: true },
				],
			},
			{
				id: 2,
				name: "Week 2",
				activities: [
					{ id: 4, instance: 101, courseId: 1, sectionId: 2, type: "assignment", name: "Problem Set 4", dueDate: days(1), visible: true, completed: false },
					{ id: 5, instance: 1, courseId: 1, sectionId: 2, type: "forum", name: "Discussion: Series convergence", visible: true, completed: false },
						{ id: 7, instance: 1, courseId: 1, sectionId: 2, type: "chat", name: "Study room", description: "<p>Drop in to work through problems together.</p>", visible: true },
						{ id: 8, instance: 1, courseId: 1, sectionId: 2, type: "bigbluebuttonbn", name: "Weekly live session", description: "<p>Thursdays at 14:00.</p>", visible: true },
						{ id: 21, instance: 3, courseId: 1, sectionId: 2, type: "quiz", name: "Quiz: Series and convergence", visible: true },
						{ id: 22, instance: 1, courseId: 1, sectionId: 2, type: "lesson", name: "Series and convergence: guided lesson", visible: true },
						{ id: 23, instance: 1, courseId: 1, sectionId: 2, type: "workshop", name: "Workshop: Peer proofs", visible: true },
						{ id: 24, instance: 1, courseId: 1, sectionId: 2, type: "choice", name: "Choice: Study group time", visible: true },
						{ id: 25, instance: 1, courseId: 1, sectionId: 2, type: "feedback", name: "Course feedback", visible: true },
						{ id: 26, instance: 1, courseId: 1, sectionId: 2, type: "survey", name: "Course experience survey", visible: true },
						{ id: 27, instance: 1, courseId: 1, sectionId: 2, type: "wiki", name: "Class wiki", visible: true },
						{ id: 28, instance: 1, courseId: 1, sectionId: 2, type: "glossary", name: "Key terms", visible: true },
						{ id: 29, instance: 1, courseId: 1, sectionId: 2, type: "data", name: "Project ideas", visible: true },
						{ id: 27, instance: 1, courseId: 1, sectionId: 2, type: "h5pactivity", name: "Interactive summary", visible: true },
						{ id: 28, instance: 1, courseId: 1, sectionId: 2, type: "scorm", name: "SCORM: Limits primer", visible: true },
						{ id: 29, instance: 1, courseId: 1, sectionId: 2, type: "lti", name: "External tool: Plagiarism checker", visible: true },
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

const ago = (n: number) => new Date(now - n * 86_400_000).toISOString();
const mockParticipants: MoodleParticipant[] = [
	{ id: 1, fullName: "Tomas", roles: ["Student"], lastAccess: ago(0), groups: [{ id: 1, name: "Group A" }] },
	{ id: 2, fullName: "Ana Costa", roles: ["Student"], lastAccess: ago(1), groups: [{ id: 1, name: "Group A" }] },
	{ id: 3, fullName: "Rui Ferreira", roles: ["Student"], lastAccess: ago(9), groups: [{ id: 2, name: "Group B" }] },
	{ id: 4, fullName: "Prof. Silva", roles: ["Teacher"], lastAccess: ago(0), groups: [] },
];
let mockCompletion: CourseCompletion = {
	completed: false,
	canSelfComplete: true,
	criteria: [
		{ title: "Complete all activities", complete: false },
		{ title: "Manual self completion", complete: false },
	],
};

const user: MoodleUser = {
	id: 1,
	username: "demo.student",
	fullName: "Tomas",
};

const notifications: MoodleNotification[] = [
	{ id: 1, subject: "Problem Set 4 has been posted", read: false, timeCreated: days(-0.5), courseId: 1, component: "mod_assign", url: "https://demo.moodleflow.dev/mod/assign/view.php?id=1101" },
	{ id: 2, subject: "New grade: Problem Set 3", body: "You scored 87/100.", read: false, timeCreated: days(-2), component: "mod_assign" },
	{ id: 3, subject: "Physics Lecture starting soon", read: true, timeCreated: days(-3), courseId: 2 },
	{ id: 4, subject: "Ana Costa replied: Does the ratio test always work?", body: "No. It's inconclusive at 1.", read: false, timeCreated: days(-0.2), courseId: 1, component: "mod_forum", url: "https://demo.moodleflow.dev/mod/forum/discuss.php?d=1" },
	{ id: 5, subject: "New message from Ana Costa", read: false, timeCreated: days(-0.1), component: "moodle", eventType: "instantmessage", url: "https://demo.moodleflow.dev/message/index.php?id=2" },
	...Array.from({ length: 24 }, (_, i): MoodleNotification => ({ id: 10 + i, subject: `Reminder: reading ${i + 1}`, read: true, timeCreated: days(-4 - i), courseId: (i % 3) + 1, component: "mod_forum" })),
];

function delay<T>(value: T, ms = 250): Promise<T> {
	return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function createMockMoodleClient(): MoodleClient {
	return {
		...createMockSocialApi(),
		...createMockQuizApi(),
		...createMockLessonApi(),
		...createMockWorkshopApi(),
		...createMockEngageApi(),
		...createMockWikiApi(),
		...createMockGlossaryApi(),
		...createMockDatabaseApi(),
		...createMockEmbedApi(),
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
		getCompletionDates: (ids) =>
			delay(
				Array.from({ length: 140 }, (_, i) => ({ courseId: ids[i % Math.max(ids.length, 1)] ?? 1, date: days(-((i * 7) % 170)) })).filter((_, i) => i % 3 !== 0),
			),
		getCourseNavOptions: () => delay(["grades", "participants", "badges"]),
		getParticipants: () => delay(mockParticipants),
		getCourseCompletion: () => delay(mockCompletion),
		selfCompleteCourse: () => {
			mockCompletion = { ...mockCompletion, completed: true, canSelfComplete: false };
			return delay(undefined);
		},
		getCourseBlocks: () =>
			delay([
				{ id: 1, name: "news_items", title: "Latest announcements", html: "<ul><li>Midterm moved to <strong>Friday</strong></li><li>Office hours cancelled this week</li></ul>" },
				{ id: 2, name: "calendar_upcoming", title: "Upcoming events", html: "<p>Problem Set 4 due tomorrow</p>" },
			]),
		getUpdatedModules: () => delay([11]),
		setActivityCompletion: (cmid, completed) => {
			for (const c of Object.values(courseContents))
				for (const sec of c.sections) for (const a of sec.activities) if (a.id === cmid) a.completed = completed;
			return delay(undefined);
		},
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
		fileUrl: (url) => url,
		getNotifications: (opts) => delay(opts?.limit ? notifications.slice(opts.offset ?? 0, (opts.offset ?? 0) + opts.limit) : notifications),
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
