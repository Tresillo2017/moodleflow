import { describe, expect, it } from "vitest";
import {
	isLessonInputComplete,
	lessonSubmission,
	nextLessonPageId,
	normalizeLessonAccess,
	normalizeLessonFinish,
	normalizeLessonGrade,
	normalizeLessonOutline,
	normalizeLessonPage,
	normalizeLessonResult,
	normalizeLessons,
	orderOutline,
} from "./normalize-lesson";
import { LESSON_EOL } from "@/types/lesson";

describe("lesson metadata", () => {
	it("maps lessons with flags and dates", () => {
		const [l] = normalizeLessons({ lessons: [{ id: 3, coursemodule: 9, course: 2, name: "L", intro: "<p>hi</p>", timelimit: 600, maxattempts: 2, retake: 1, review: 0, usepassword: 1, progressbar: 1, ongoing: 1, grade: 10, available: 1700000000, deadline: 0 }] });
		expect(l).toMatchObject({ id: 3, cmid: 9, courseId: 2, timeLimit: 600, maxAttempts: 2, retake: true, review: false, passwordRequired: true, progressBar: true, ongoingScore: true, grade: 10 });
		expect(l.available).toBe(new Date(1700000000_000).toISOString());
		expect(l.deadline).toBeUndefined();
	});

	it("maps access information", () => {
		expect(normalizeLessonAccess({ canmanage: false, preventaccessreasons: [{ reason: "notavailable", message: "Not open yet" }], attemptscount: 1, firstpageid: 4, lastpageseen: 0 })).toEqual({
			canManage: false,
			blocked: ["Not open yet"],
			attempts: 1,
			firstPageId: 4,
			lastPageSeen: undefined,
		});
	});

	it("orders the page outline by its linked list", () => {
		const outline = normalizeLessonOutline({ pages: [{ page: { id: 3, title: "C", typeid: 3, prevpageid: 2, nextpageid: 0 } }, { page: { id: 1, title: "A", typeid: 20, prevpageid: 0, nextpageid: 2 } }, { page: { id: 2, title: "B", typeid: 2, prevpageid: 1, nextpageid: 3 } }] });
		expect(orderOutline(outline).map((p) => p.id)).toEqual([1, 2, 3]);
		expect(outline.find((p) => p.id === 2)?.kind).toBe("truefalse");
	});
});

describe("lesson pages", () => {
	const content = normalizeLessonPage({
		page: { id: 1, title: "Intro", typeid: 20, contents: "<p>x</p>", prevpageid: 0, nextpageid: 2 },
		answers: [{ id: 10, answer: "Go", jumpto: 2 }, { id: 11, answer: "Skip", jumpto: -9 }],
		progress: 25,
		ongoingscore: "1 / 2",
	});

	it("maps content pages with branch buttons", () => {
		expect(content).toMatchObject({ id: 1, kind: "content", nextId: 2, progress: 25, ongoingScore: "1 / 2" });
		expect(content.answers).toEqual([{ id: 10, text: "Go", jumpTo: 2 }, { id: 11, text: "Skip", jumpTo: LESSON_EOL }]);
		expect(lessonSubmission(content, { jumpTo: 2 })).toEqual([{ name: "jumpto", value: "2" }]);
	});

	it("submits single and multiple choice answers with the form marker", () => {
		const single = normalizeLessonPage({ page: { id: 2, typeid: 3, qoption: 0 }, answers: [{ id: 20, answer: "A" }, { id: 21, answer: "B" }] });
		expect(lessonSubmission(single, { choice: 21 })).toEqual([{ name: "_qf__lesson_display_answer_form_multichoice_singleanswer", value: "1" }, { name: "answerid", value: "21" }]);
		const multi = normalizeLessonPage({ page: { id: 2, typeid: 3, qoption: 1 }, answers: [{ id: 20, answer: "A" }, { id: 21, answer: "B" }] });
		expect(multi.multiple).toBe(true);
		expect(lessonSubmission(multi, { choices: [20, 21] }).slice(1)).toEqual([{ name: "answer[20]", value: "1" }, { name: "answer[21]", value: "1" }]);
		expect(isLessonInputComplete(multi, {})).toBe(false);
		expect(isLessonInputComplete(multi, { choices: [20] })).toBe(true);
	});

	it("prefers the form markers Moodle rendered", () => {
		const p = normalizeLessonPage({ page: { id: 2, typeid: 2 }, pagecontent: '<form><input type="hidden" name="_qf__lesson_display_answer_form_truefalse" value="1"><input name="sesskey" type="hidden" value="x"></form>', answers: [{ id: 1, answer: "True" }] });
		expect(p.formFields).toEqual({ _qf__lesson_display_answer_form_truefalse: "1" });
	});

	it("builds matching pairs from the rendered selects", () => {
		const p = normalizeLessonPage({
			page: { id: 5, typeid: 5 },
			answers: [{ id: 50, answer: "", response: "" }, { id: 51, answer: "", response: "" }, { id: 52, answer: "<p>Cat</p>", response: "Meow" }, { id: 53, answer: "<p>Dog</p>", response: "Woof &amp; grr" }],
			pagecontent: '<select name="response[52]"><option value="">Choose</option><option value="Meow">Meow</option><option value="Woof &amp; grr">Woof &amp; grr</option></select><select name="response[53]"><option value="">Choose</option><option value="Meow">Meow</option><option value="Woof &amp; grr">Woof &amp; grr</option></select>',
		});
		expect(p.pairs.map((x) => x.id)).toEqual([52, 53]);
		expect(p.pairs[0].options.map((o) => o.value)).toEqual(["Meow", "Woof & grr"]);
		expect(lessonSubmission(p, { matches: { 52: "Meow", 53: "Woof & grr" } }).filter((d) => d.name.startsWith("response"))).toEqual([{ name: "response[52]", value: "Meow" }, { name: "response[53]", value: "Woof & grr" }]);
		expect(isLessonInputComplete(p, { matches: { 52: "Meow" } })).toBe(false);
	});

	it("falls back to shared response options when the page has no selects", () => {
		const p = normalizeLessonPage({ page: { id: 5, typeid: 5 }, answers: [{ id: 52, answer: "Cat", response: "Meow" }, { id: 53, answer: "Dog", response: "Woof" }] });
		expect(p.pairs[0].options.map((o) => o.value)).toEqual(["Meow", "Woof"]);
	});

	it("submits text and essay answers", () => {
		const sa = normalizeLessonPage({ page: { id: 6, typeid: 1 } });
		expect(lessonSubmission(sa, { text: "hi" }).at(-1)).toEqual({ name: "answer", value: "hi" });
		const essay = normalizeLessonPage({ page: { id: 7, typeid: 10 } });
		expect(lessonSubmission(essay, { text: "words" }).slice(-2)).toEqual([{ name: "answer_editor[text]", value: "words" }, { name: "answer_editor[format]", value: "2" }]);
		expect(isLessonInputComplete(essay, { text: "  " })).toBe(false);
	});

	it("marks unknown page types", () => {
		expect(normalizeLessonPage({ page: { id: 9, typeid: 30 } }).kind).toBe("unknown");
	});
});

describe("lesson flow", () => {
	it("maps process_page results", () => {
		const r = normalizeLessonResult({ newpageid: 4, feedback: "<p>Correct</p>", correctanswer: true, attemptsremaining: 0, response: "<p> </p>", progress: 50 });
		expect(r).toMatchObject({ newPageId: 4, feedback: "<p>Correct</p>", correct: true, progress: 50 });
		expect(r.response).toBeUndefined();
	});

	it("resolves the next page", () => {
		const page = { id: 3, nextId: 4 };
		expect(nextLessonPageId(7, page)).toBe(7);
		expect(nextLessonPageId(0, page)).toBe(3);
		expect(nextLessonPageId(LESSON_EOL, page)).toBe(LESSON_EOL);
		expect(nextLessonPageId(-1, page)).toBe(4);
		expect(nextLessonPageId(-1, { id: 3, nextId: 0 })).toBe(LESSON_EOL);
	});

	it("maps finish_attempt data and messages", () => {
		const f = normalizeLessonFinish({ data: [{ name: "numberofpagesviewed", value: "5" }, { name: "welldone", value: "1" }, { name: "gradelesson", value: "1" }, { name: "note", value: "" }], messages: [{ message: "<p>Done</p>", type: "success" }] });
		expect(f.messages).toEqual(["<p>Done</p>"]);
		expect(f.results).toEqual([{ label: "Questions answered", value: "5" }]);
	});

	it("maps grades", () => {
		expect(normalizeLessonGrade({ grade: 7.5, formattedgrade: "7.50" })).toEqual({ grade: 7.5, formatted: "7.50" });
		expect(normalizeLessonGrade({ grade: null })).toEqual({ grade: null, formatted: undefined });
	});
});
