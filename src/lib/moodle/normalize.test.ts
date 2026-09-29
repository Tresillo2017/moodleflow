import { describe, expect, it } from "vitest";
import { MoodleError } from "@/types/moodle";
import {
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
				status: "not_started",
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
