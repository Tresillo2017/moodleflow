import { describe, expect, it } from "vitest";
import { MoodleError } from "@/types/moodle";
import {
	applySubmissionStatus,
	deriveSubmissionStatus,
	normalizeAssignments,
	normalizeCourseContent,
	normalizeCourses,
	normalizeForumDiscussions,
	normalizeGrades,
	normalizeSiteInfo,
} from "./normalize";

describe("normalizeSiteInfo", () => {
	it("maps a successful site info response", () => {
		const info = normalizeSiteInfo({
			sitename: "Demo Uni",
			siteurl: "https://moodle.example.com",
			userid: 5,
			username: "jdoe",
			fullname: "Jane Doe",
			release: "4.4",
			functions: [{ name: "core_webservice_get_site_info" }],
		});
		expect(info).toEqual({
			siteName: "Demo Uni",
			siteUrl: "https://moodle.example.com",
			userId: 5,
			username: "jdoe",
			fullName: "Jane Doe",
			userPictureUrl: undefined,
			release: "4.4",
			functions: ["core_webservice_get_site_info"],
		});
	});

	it("throws a MoodleError on a malformed (non-object) response", () => {
		expect(() => normalizeSiteInfo(null)).toThrow(MoodleError);
	});
});

describe("normalizeCourses", () => {
	it("normalizes an empty course list", () => {
		expect(normalizeCourses([])).toEqual([]);
	});

	it("normalizes course fields and defaults visible to true", () => {
		const courses = normalizeCourses([
			{ id: 1, shortname: "CS101", fullname: "Intro to CS", progress: 40 },
		]);
		expect(courses).toEqual([
			expect.objectContaining({ id: 1, shortName: "CS101", fullName: "Intro to CS", progress: 40, visible: true }),
		]);
	});
});

describe("normalizeCourseContent", () => {
	it("maps known modnames to activity types and unknown ones to 'unknown'", () => {
		const content = normalizeCourseContent(1, [
			{
				id: 10,
				name: "Week 1",
				modules: [
					{ id: 100, modname: "assign", name: "Essay" },
					{ id: 101, modname: "someweirdplugin", name: "Mystery activity" },
				],
			},
		]);
		expect(content.sections[0].activities.map((a) => a.type)).toEqual(["assignment", "unknown"]);
	});
});

describe("normalizeAssignments", () => {
	it("flattens nested course.assignments and converts unix due dates", () => {
		const dueUnix = 1_700_000_000;
		const assignments = normalizeAssignments({
			courses: [
				{
					id: 2,
					fullname: "Physics",
					assignments: [{ id: 200, name: "Lab report", duedate: dueUnix }],
				},
			],
		});
		expect(assignments).toEqual([
			expect.objectContaining({
				id: 200,
				courseId: 2,
				courseName: "Physics",
				name: "Lab report",
				dueDate: new Date(dueUnix * 1000).toISOString(),
				status: "unknown",
			}),
		]);
	});

	it("returns an empty list when there are no courses", () => {
		expect(normalizeAssignments({ courses: [] })).toEqual([]);
	});
});

describe("normalizeGrades", () => {
	it("maps usergrades into per-course grade items", () => {
		const grades = normalizeGrades({
			usergrades: [
				{
					courseid: 3,
					coursename: "History",
					gradeitems: [
						{ id: 30, itemname: "Essay", graderaw: 88, grademax: 100, gradeletter: "B+", dategraded: 1_700_000_000 },
					],
				},
			],
		});
		expect(grades).toEqual([
			expect.objectContaining({
				courseId: 3,
				courseName: "History",
				items: [
					expect.objectContaining({
						itemName: "Essay",
						grade: 88,
						maxGrade: 100,
						letterGrade: "B+",
						gradedDate: new Date(1_700_000_000 * 1000).toISOString(),
					}),
				],
			}),
		]);
	});
});

describe("normalizeCourseContent files", () => {
	it("keeps instance id and only file-type contents", () => {
		const content = normalizeCourseContent(1, [
			{
				id: 10,
				name: "Week 1",
				modules: [
					{
						id: 55,
						instance: 7,
						modname: "resource",
						name: "Notes",
						contents: [
							{ type: "file", filename: "a.pdf", fileurl: "https://m.example/pluginfile.php/a.pdf", filesize: 2048, mimetype: "application/pdf" },
							{ type: "url", fileurl: "https://elsewhere.example" },
						],
					},
				],
			},
		]);
		const [activity] = content.sections[0].activities;
		expect(activity.instance).toBe(7);
		expect(activity.files).toEqual([
			{ name: "a.pdf", url: "https://m.example/pluginfile.php/a.pdf", size: 2048, mimeType: "application/pdf" },
		]);
	});
});

describe("normalizeGrades percentage", () => {
	it("parses Moodle's formatted percentage string", () => {
		const [course] = normalizeGrades({
			usergrades: [{ courseid: 1, coursename: "X", gradeitems: [{ id: 1, itemname: "A", percentageformatted: "85.50 %" }] }],
		});
		expect(course.items[0].percentage).toBe(85.5);
	});
});

describe("normalizeForumDiscussions", () => {
	it("maps discussions and tolerates an empty response", () => {
		const list = normalizeForumDiscussions({
			discussions: [{ discussion: 9, subject: "Hi", userfullname: "Ana", timemodified: 1_700_000_000, numreplies: 3, pinned: true }],
		});
		expect(list).toEqual([
			{ id: 9, subject: "Hi", author: "Ana", timeModified: new Date(1_700_000_000 * 1000).toISOString(), replies: 3, pinned: true },
		]);
		expect(normalizeForumDiscussions({})).toEqual([]);
	});
});

describe("deriveSubmissionStatus", () => {
	const due = new Date("2026-01-10T12:00:00Z").toISOString();
	const after = new Date("2026-01-11T00:00:00Z").getTime();

	it("never reports a submitted assignment as overdue", () => {
		expect(deriveSubmissionStatus({ submissionStatus: "submitted", graded: false, dueDate: due, submittedAt: "2026-01-09T00:00:00Z", now: after })).toBe("submitted");
	});

	it("flags submissions made after the due date as late", () => {
		expect(deriveSubmissionStatus({ submissionStatus: "submitted", graded: false, dueDate: due, submittedAt: "2026-01-10T18:00:00Z", now: after })).toBe("late");
	});

	it("keeps drafts as drafts even past the due date", () => {
		expect(deriveSubmissionStatus({ submissionStatus: "draft", graded: false, dueDate: due, now: after })).toBe("draft");
	});

	it("is overdue only with nothing submitted and a passed due date", () => {
		expect(deriveSubmissionStatus({ submissionStatus: "new", graded: false, dueDate: due, now: after })).toBe("overdue");
		expect(deriveSubmissionStatus({ submissionStatus: "new", graded: false, dueDate: due, now: 0 })).toBe("not_started");
		expect(deriveSubmissionStatus({ graded: false, now: after })).toBe("not_started");
	});

	it("graded wins over everything", () => {
		expect(deriveSubmissionStatus({ submissionStatus: "submitted", graded: true, dueDate: due, now: after })).toBe("graded");
	});
});

describe("applySubmissionStatus", () => {
	const base = normalizeAssignments({
		courses: [{ id: 1, fullname: "C", assignments: [{ id: 5, name: "A", duedate: 1_700_000_000, grade: 100, submissiondrafts: 1,
			configs: [
				{ plugin: "onlinetext", subtype: "assignsubmission", name: "enabled", value: "1" },
				{ plugin: "file", subtype: "assignsubmission", name: "enabled", value: "1" },
				{ plugin: "file", subtype: "assignsubmission", name: "maxfilesubmissions", value: "2" },
			] }] }],
	})[0];

	it("reads submission config from the assignment", () => {
		expect(base.status).toBe("unknown");
		expect(base.config).toMatchObject({ acceptsText: true, acceptsFiles: true, maxFiles: 2, requiresSubmitAction: true });
	});

	it("extracts text, files, editability and a submitted status", () => {
		const a = applySubmissionStatus(base, {
			lastattempt: {
				canedit: true,
				submission: {
					status: "submitted",
					timemodified: 1_699_990_000,
					plugins: [
						{ type: "onlinetext", editorfields: [{ name: "onlinetext", text: "<p>hi</p>" }] },
						{ type: "file", fileareas: [{ area: "submission_files", files: [{ filename: "a.pdf", fileurl: "https://m/a.pdf", filesize: 10 }] }] },
					],
				},
			},
		});
		expect(a.status).toBe("submitted");
		expect(a.canEdit).toBe(true);
		expect(a.submission?.text).toBe("<p>hi</p>");
		expect(a.submission?.files).toEqual([{ name: "a.pdf", url: "https://m/a.pdf", size: 10, mimeType: undefined }]);
	});

	it("treats a negative grade as ungraded and reads feedback comments", () => {
		const ungraded = applySubmissionStatus(base, { feedback: { grade: { grade: "-1.00000" } } });
		expect(ungraded.grade).toBeUndefined();
		const graded = applySubmissionStatus(base, {
			feedback: { grade: { grade: "87.00000" }, plugins: [{ type: "comments", editorfields: [{ name: "comments", text: "Nice" }] }] },
		});
		expect(graded).toMatchObject({ status: "graded", grade: 87, feedback: "Nice" });
	});
});
