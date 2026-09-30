import { describe, expect, it } from "vitest";
import {
	assessmentData,
	isAssessmentComplete,
	normalizeAssessmentForm,
	normalizeWorkshopAccess,
	normalizeWorkshopAssessments,
	normalizeWorkshopGrades,
	normalizeWorkshopPlan,
	normalizeWorkshops,
	normalizeWorkshopSubmissions,
	normalizeWorkshopSubmissionDetail,
} from "./normalize-workshop";

describe("workshop settings", () => {
	it("maps phase, submission types and grades", () => {
		const [w] = normalizeWorkshops({
			workshops: [{ id: 3, coursemodule: 9, course: 2, name: "Essay", strategy: "rubric", phase: 30, submissiontypetext: 2, submissiontypefile: 1, nattachments: 2, maxbytes: 1000, grade: "80.0", gradinggrade: 20, submissionend: 0, assessmentend: 100 }],
		});
		expect(w).toMatchObject({ id: 3, cmid: 9, courseId: 2, strategy: "rubric", phase: "assessment", text: "required", files: "optional", maxAttachments: 2, maxBytes: 1000, grade: 80 });
		expect(w.submissionEnd).toBeUndefined();
		expect(w.assessmentEnd).toBeDefined();
	});

	it("falls back to attachments-only settings on older sites", () => {
		const [w] = normalizeWorkshops({ workshops: [{ id: 1, nattachments: 0, phase: 0 }] });
		expect(w).toMatchObject({ phase: "setup", text: "optional", files: "off" });
	});

	it("derives what the user may do now from the phase when the site lacks the flags", () => {
		const a = normalizeWorkshopAccess({ cansubmit: true, canpeerassess: true }, "submission");
		expect(a).toMatchObject({ canCreateSubmission: true, canAssessNow: false });
		expect(normalizeWorkshopAccess({ cansubmit: true, creatingsubmissionallowed: false }, "submission").canCreateSubmission).toBe(false);
	});
});

describe("phase planner", () => {
	it("reads phases and task states", () => {
		const [setup, sub] = normalizeWorkshopPlan({
			userplan: { phases: [
				{ code: 10, title: "Setup", active: false, tasks: [] },
				{ code: 20, title: "Submission phase", active: true, tasks: [{ title: "<a href='x'>Submit</a>", completed: "n", link: "https://m/x" }, { title: "Done thing", completed: "y" }, { title: "FYI", completed: "info", details: "<b>3</b> left" }] },
			] },
		});
		expect(setup.phase).toBe("setup");
		expect(sub).toMatchObject({ phase: "submission", active: true });
		expect(sub.tasks.map((t) => t.status)).toEqual(["todo", "done", "info"]);
		expect(sub.tasks[0].title).toBe("Submit");
		expect(sub.tasks[2].details).toBe("3 left");
	});
});

describe("submissions", () => {
	it("drops example submissions and keeps ungraded as undefined", () => {
		const list = normalizeWorkshopSubmissions({ submissions: [{ id: 1, authorid: 5, title: "Mine", content: "<p>x</p>", grade: null, late: 0, published: 0 }, { id: 2, example: 1, title: "Ex" }] });
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ id: 1, authorId: 5, grade: undefined, late: false });
	});

	it("reads attachments from the detail call", () => {
		const s = normalizeWorkshopSubmissionDetail({ submission: { id: 4, authorid: 1, title: "T", attachmentfiles: [{ filename: "a.pdf", fileurl: "https://m/a.pdf", filesize: 10 }, { filename: "broken" }] } });
		expect(s.files).toEqual([{ name: "a.pdf", url: "https://m/a.pdf", size: 10, mimeType: undefined }]);
	});
});

describe("assessments and grades", () => {
	it("prefers the overridden grading grade", () => {
		const [a] = normalizeWorkshopAssessments({ assessments: [{ id: 1, submissionid: 2, reviewerid: 3, grade: "75", gradinggrade: 10, gradinggradeover: 15, weight: 1 }] });
		expect(a).toMatchObject({ grade: 75, gradingGrade: 15, submissionId: 2 });
	});

	it("reads gradebook cells and hides hidden ones", () => {
		expect(normalizeWorkshopGrades({ submissiongrade: { grade: "64.00", hidden: 0 }, assessmentgrade: { grade: 18, hidden: 1 } })).toEqual({ submission: 64, assessment: undefined });
	});
});

describe("assessment form", () => {
	const accumulative = {
		dimenssionscount: 2,
		fields: [
			{ dimensionid: 11, description: "<p>Clarity</p>", grade: 10, weight: 1 },
			{ dimensionid: 12, description: "Sources", grade: 5, weight: 2 },
		],
		current: [
			{ name: "grade__idx_0", value: 7 },
			{ name: "peercomment__idx_0", value: "good" },
		],
	};

	it("merges dimension definitions with current answers", () => {
		const form = normalizeAssessmentForm(accumulative, 40, "accumulative");
		expect(form.supported).toBe(true);
		expect(form.dimensions).toMatchObject([{ id: 11, maxGrade: 10, grade: 7, comment: "good" }, { id: 12, maxGrade: 5, weight: 2 }]);
	});

	it("accepts flat name/value definitions", () => {
		const form = normalizeAssessmentForm({ fields: [{ name: "dimensionid__idx_0", value: 3 }, { name: "description__idx_0", value: "A" }, { name: "grade__idx_0", value: 4 }] }, 1, "accumulative");
		expect(form.dimensions).toMatchObject([{ id: 3, description: "A", maxGrade: 4 }]);
	});

	it("reads rubric levels and numerrors labels", () => {
		const rubric = normalizeAssessmentForm({ fields: [{ dimensionid: 1, description: "R", levels: [{ id: 5, grade: 0, definition: "Poor" }, { id: 6, grade: 4, definition: "Great" }] }], current: [{ name: "chosenlevelid__idx_0", value: 6 }] }, 1, "rubric");
		expect(rubric.dimensions[0]).toMatchObject({ chosenLevel: 6, levels: [{ id: 5 }, { id: 6 }] });
		const errors = normalizeAssessmentForm({ fields: [{ dimensionid: 1, description: "Q", grade0: "Missing", grade1: "Present" }] }, 1, "numerrors");
		expect(errors.dimensions[0].labels).toEqual(["Missing", "Present"]);
	});

	it("marks unknown strategies, empty forms and scale grades without items as unsupported", () => {
		expect(normalizeAssessmentForm(accumulative, 1, "custom").supported).toBe(false);
		expect(normalizeAssessmentForm({ fields: [] }, 1, "comments").supported).toBe(false);
		expect(normalizeAssessmentForm({ fields: [{ dimensionid: 1, grade: -3 }] }, 1, "accumulative").supported).toBe(false);
		expect(normalizeAssessmentForm({ fields: [{ dimensionid: 1, grade: -3, scale: "Bad,OK,Good" }] }, 1, "accumulative").dimensions[0].scale).toEqual(["Bad", "OK", "Good"]);
	});

	it("writes answers back under the form's own field names", () => {
		const form = normalizeAssessmentForm(accumulative, 40, "accumulative");
		const data = assessmentData(form, { feedback: "nice", dimensions: { 0: { grade: 8, comment: "c" }, 1: { grade: 2 } } });
		expect(data).toContainEqual({ name: "grade__idx_0", value: 8 });
		expect(data).toContainEqual({ name: "dimensionid__idx_1", value: 12 });
		expect(data).toContainEqual({ name: "peercomment__idx_0", value: "c" });
		expect(data).toContainEqual({ name: "feedbackauthor_editor", value: "nice" });
	});

	it("sends the chosen rubric level and no grade for comments", () => {
		const rubric = normalizeAssessmentForm({ fields: [{ dimensionid: 1, levels: [{ id: 5, grade: 1, definition: "x" }] }] }, 1, "rubric");
		expect(assessmentData(rubric, { feedback: "", dimensions: { 0: { chosenLevel: 5 } } })).toContainEqual({ name: "chosenlevelid__idx_0", value: 5 });
		const comments = normalizeAssessmentForm({ fields: [{ dimensionid: 1, description: "d" }] }, 1, "comments");
		expect(assessmentData(comments, { feedback: "", dimensions: {} }).some((d) => d.name.startsWith("grade__"))).toBe(false);
	});

	it("needs a grade for every graded dimension before it's complete", () => {
		const form = normalizeAssessmentForm(accumulative, 40, "accumulative");
		expect(isAssessmentComplete(form, { feedback: "", dimensions: { 0: { grade: 1 } } })).toBe(false);
		expect(isAssessmentComplete(form, { feedback: "", dimensions: { 0: { grade: 1 }, 1: { grade: 0 } } })).toBe(true);
	});
});
