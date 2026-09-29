import { describe, expect, it } from "vitest";
import { MoodleError } from "@/types/moodle";
import {
	applySubmissionStatus,
	deriveSubmissionStatus,
	normalizeAssignments,
	normalizeCourseBlocks,
	normalizeCourseCompletion,
	normalizeCourseContent,
	normalizeNavOptions,
	normalizeParticipants,
	normalizeUpdatedModules,
	normalizeCourses,
	normalizeForumDiscussions,
	normalizeGrades,
	normalizeSiteConfig,
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

describe("normalizeCourseContent activity details", () => {
	it("extracts url target, book chapters, manual completion and restrictions", () => {
		const [section] = normalizeCourseContent(1, [
			{
				id: 1,
				name: "S",
				modules: [
					{ id: 1, modname: "url", name: "Link", contents: [{ type: "url", fileurl: "https://example.com" }] },
					{
						id: 2,
						modname: "book",
						name: "Book",
						contents: [{ type: "content", filename: "structure", content: '[{"title":"One","href":"1/index.html","level":0}]' }],
					},
					{ id: 3, modname: "page", name: "P", completion: 1, completiondata: { state: 0 } },
					{ id: 4, modname: "quiz", name: "Q", uservisible: false, availabilityinfo: "<p>Later</p>" },
				],
			},
		]).sections;
		const [url, book, page, quiz] = section.activities;
		expect(url.externalUrl).toBe("https://example.com");
		expect(book.chapters).toEqual([{ title: "One", href: "1/index.html", level: 0 }]);
		expect(page).toMatchObject({ manualCompletion: true, completed: false });
		expect(quiz).toMatchObject({ locked: true, availabilityInfo: "<p>Later</p>" });
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

	it("uses a granted extension as the due date and keeps the original", () => {
		const a = applySubmissionStatus(base, { lastattempt: { extensionduedate: 1_700_100_000 } });
		expect(a.dueDate).toBe(new Date(1_700_100_000_000).toISOString());
		expect(a.originalDueDate).toBe(base.dueDate);
		expect(applySubmissionStatus(base, { lastattempt: { extensionduedate: 1_600_000_000 } }).originalDueDate).toBeUndefined();
	});

	it("prefers the shared team submission on group assignments", () => {
		const a = applySubmissionStatus(base, {
			lastattempt: { submission: { status: "draft" }, teamsubmission: { status: "submitted", timemodified: 1_699_990_000 } },
		});
		expect(a.submission?.status).toBe("submitted");
	});

	it("keeps rubric HTML from gradefordisplay but not a plain grade string", () => {
		expect(applySubmissionStatus(base, { feedback: { gradefordisplay: "<table class='rubric'></table>" } }).gradingDetails).toContain("rubric");
		expect(applySubmissionStatus(base, { feedback: { gradefordisplay: "85.00 / 100.00" } }).gradingDetails).toBeUndefined();
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

describe("normalizeCourses banner", () => {
	it("prefers courseimage, falls back to the first image overview file", () => {
		const [a, b, c] = normalizeCourses([
			{ id: 1, shortname: "A", courseimage: "https://m/a.jpg" },
			{ id: 2, shortname: "B", overviewfiles: [{ fileurl: "https://m/webservice/pluginfile.php/1/b.png", mimetype: "image/png" }] },
			{ id: 3, shortname: "C", overviewfiles: [{ fileurl: "https://m/doc.pdf", mimetype: "application/pdf" }] },
		]);
		expect(a.imageUrl).toBe("https://m/a.jpg");
		expect(b.imageUrl).toBe("https://m/webservice/pluginfile.php/1/b.png");
		expect(c.imageUrl).toBeUndefined();
	});
});

describe("normalizeSiteConfig", () => {
	const info = { siteName: "Info Name", siteUrl: "", userId: 1, username: "u", fullName: "U", release: "4.3", functions: [], maxUploadBytes: 5000 };

	it("prefers tool_mobile settings and reads registration and policy flags", () => {
		const raw = { settings: [{ name: "sitename", value: "My School" }, { name: "compactlogourl", value: "https://x/logo.png" }, { name: "registerauth", value: "email" }, { name: "sitepolicy", value: "https://x/policy" }] };
		expect(normalizeSiteConfig(raw, info)).toEqual({ siteName: "My School", logoUrl: "https://x/logo.png", maxUploadBytes: 5000, registrationEnabled: true, policyUrl: "https://x/policy" });
	});

	it("falls back to site info when the config call is unavailable", () => {
		expect(normalizeSiteConfig(null, info)).toEqual({ siteName: "Info Name", logoUrl: undefined, maxUploadBytes: 5000, registrationEnabled: false, policyUrl: undefined });
	});
});

describe("course extras", () => {
	it("keeps only available nav options", () => {
		expect(normalizeNavOptions({ courses: [{ id: 1, navoptions: [{ name: "grades", available: true }, { name: "badges", available: false }] }] })).toEqual(["grades"]);
	});

	it("maps participants with roles, groups and last access", () => {
		const [p] = normalizeParticipants([{ id: 2, fullname: "Ana", roles: [{ shortname: "student", name: "Student" }], groups: [{ id: 1, name: "A" }], lastcourseaccess: 0 }]);
		expect(p).toMatchObject({ id: 2, fullName: "Ana", roles: ["Student"], groups: [{ id: 1, name: "A" }], lastAccess: undefined });
	});

	it("detects a pending self-completion criterion", () => {
		const c = normalizeCourseCompletion({ completionstatus: { completed: false, completions: [{ type: 1, title: "Self", complete: false }, { type: 4, title: "Activities", complete: true }] } });
		expect(c.canSelfComplete).toBe(true);
		expect(c.criteria).toEqual([{ title: "Self", complete: false }, { title: "Activities", complete: true }]);
	});

	it("drops empty blocks and non-module updates", () => {
		expect(
			normalizeCourseBlocks({
				blocks: [
					{ instanceid: 1, name: "news_items", contents: { title: "T", content: "<p>x</p>" } },
					{ instanceid: 2, name: "html", contents: { content: " " } },
					{ instanceid: 3, name: "navigation", contents: { title: "Navigation", content: "<ul></ul>" } },
					{ instanceid: 4, name: "timeline", contents: { title: "Timeline", content: "<p>x</p>" } },
					{ instanceid: 5, name: "dashboard_stats", contents: { title: "Stats", content: "&lt;div class=zoom&gt;" } },
					{ instanceid: 6, name: "custom_plugin", contents: { title: "Custom", content: "<p>y</p>" } },
				],
			}),
		).toHaveLength(2);
		expect(normalizeUpdatedModules({ instances: [{ contextlevel: "module", id: 5 }, { contextlevel: "course", id: 1 }] })).toEqual([5]);
	});
});
