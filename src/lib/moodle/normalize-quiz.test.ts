// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
	isQuestionAnswered,
	normalizeQuizAccess,
	normalizeQuizAttempt,
	normalizeQuizAttemptAccess,
	normalizeQuizAttemptPage,
	normalizeQuizAttemptReview,
	normalizeQuizAttempts,
	normalizeQuizBestGrade,
	normalizeQuizReviewOptions,
	normalizeQuizSummary,
	normalizeQuizzes,
	quizAnswerData,
} from "./normalize-quiz";
import { createMockQuizApi } from "./mock-quiz";
import { mapQuestionState, normalizeQuizQuestion } from "./normalize-quiz-question";

const FLAG = `<div class="questionflag editable"><input type="hidden" name="q9:1_:flagged" value="0"><input type="checkbox" id="q9:1_:flaggedcheckbox" name="q9:1_:flagged" value="1" class="questionflagcheckbox"><input type="hidden" value="qaid=77&amp;qubaid=9&amp;questionid=5&amp;newstate=0&amp;slot=1&amp;checksum=abc123&amp;sesskey=zzz" class="questionflagpostdata"></div>`;

const multichoice = (checked = "") => `
<div id="question-9-1" class="que multichoice deferredfeedback notyetanswered">
 <div class="info"><h3 class="no">Question <span class="qno">1</span></h3><div class="state">Not yet answered</div>${FLAG}</div>
 <div class="content"><div class="formulation clearfix">
  <input type="hidden" name="q9:1_:sequencecheck" value="3">
  <div class="qtext"><p>Which are primes?</p></div>
  <div class="ablock"><div class="prompt">Select one:</div>
   <div class="answer">
    <div class="r0"><input type="radio" name="q9:1_answer" value="0" id="q9:1_answer0" ${checked}><div class="d-flex w-auto"><span class="answernumber">a. </span><div class="flex-fill ml-1"><p>Four</p></div></div></div>
    <div class="r1"><input type="radio" name="q9:1_answer" value="1" id="q9:1_answer1"><div class="d-flex w-auto"><span class="answernumber">b. </span><div class="flex-fill ml-1"><p>Seven</p></div></div></div>
    <input type="radio" name="q9:1_answer" value="-1" class="sr-only">
   </div></div></div></div></div>`;

const multi = `
<div class="que multichoice"><div class="content"><div class="formulation">
 <input type="hidden" name="q9:2_:sequencecheck" value="1">
 <div class="qtext">Pick all.</div>
 <div class="ablock"><div class="answer">
  <div class="r0"><input type="hidden" name="q9:2_choice0" value="0"><input type="checkbox" name="q9:2_choice0" value="1" checked><label><span class="answernumber">a. </span>One</label></div>
  <div class="r1"><input type="hidden" name="q9:2_choice1" value="0"><input type="checkbox" name="q9:2_choice1" value="1"><label><span class="answernumber">b. </span>Two</label></div>
 </div></div></div></div></div>`;

describe("normalizeQuizQuestion: multichoice", () => {
	it("parses options, strips prefixes and clear-choice, and lifts flag data", () => {
		const q = normalizeQuizQuestion({ slot: 1, type: "multichoice", page: 0, html: multichoice(), flagged: true, number: 1, state: "todo", status: "Not yet answered", maxmark: "1.00" }, { qubaId: 9 });
		expect(q).toMatchObject({ slot: 1, number: "1", flagged: true, state: "todo", maxMark: "1.00", readOnly: false });
		expect(q.textHtml).toBe("<p>Which are primes?</p>");
		expect(q.body).toMatchObject({ kind: "choice", multiple: false, prompt: "Select one:", field: "q9:1_answer" });
		if (q.body.kind !== "choice") throw new Error();
		expect(q.body.options.map((o) => [o.value, o.html])).toEqual([
			["0", "<p>Four</p>"],
			["1", "<p>Seven</p>"],
		]);
		expect(q.flag).toEqual({ qubaId: 9, qaId: 77, questionId: 5, slot: 1, checksum: "abc123" });
		expect(q.fields).toEqual({ "q9:1_:sequencecheck": "3" });
	});

	it("reads the ticked radio into fields", () => {
		const q = normalizeQuizQuestion({ slot: 1, type: "multichoice", html: multichoice("checked") });
		expect(q.fields["q9:1_answer"]).toBe("0");
	});

	it("parses checkboxes: hidden zero unless ticked", () => {
		const q = normalizeQuizQuestion({ slot: 2, type: "multichoice", html: multi });
		expect(q.body).toMatchObject({ kind: "choice", multiple: true });
		expect(q.fields).toEqual({ "q9:2_:sequencecheck": "1", "q9:2_choice0": "1", "q9:2_choice1": "0" });
		if (q.body.kind !== "choice") throw new Error();
		expect(q.body.options.map((o) => [o.field, o.html])).toEqual([
			["q9:2_choice0", "One"],
			["q9:2_choice1", "Two"],
		]);
	});

	it("keeps per-option feedback and correctness in review mode", () => {
		const html = `<div class="que multichoice"><div class="content"><div class="formulation"><div class="qtext">Q</div><div class="answer">
			<div class="r0 correct"><input type="radio" name="q9:1_answer" value="0" checked disabled><label>Yes</label><div class="specificfeedback">Well done</div></div>
			<div class="r1"><input type="radio" name="q9:1_answer" value="1" disabled><label>No</label></div></div></div>
			<div class="outcome clearfix"><div class="feedback"><div class="specificfeedback">Right!</div><div class="rightanswer">The correct answer is: Yes</div></div></div>
			<div class="comment clearfix"><div class="comment">Nice reasoning</div></div></div></div>`;
		const q = normalizeQuizQuestion({ slot: 1, type: "multichoice", html, state: "gradedright", mark: "1.00", maxmark: "1.00" }, { review: true });
		if (q.body.kind !== "choice") throw new Error();
		expect(q.readOnly).toBe(true);
		expect(q.state).toBe("correct");
		expect(q.body.options[0]).toMatchObject({ html: "Yes", correctness: "correct", feedbackHtml: "Well done" });
		expect(q.feedback).toEqual([
			{ kind: "specific", html: "Right!" },
			{ kind: "rightanswer", html: "The correct answer is: Yes" },
			{ kind: "teacher", html: "Nice reasoning" },
		]);
	});
});

describe("normalizeQuizQuestion: other types", () => {
	it("parses a short answer", () => {
		const html = `<div class="que shortanswer"><div class="content"><div class="formulation"><input type="hidden" name="q9:3_:sequencecheck" value="1"><div class="qtext">Capital of France?</div><div class="ablock"><span class="answer"><label class="sr-only" for="a">Answer</label><input type="text" name="q9:3_answer" id="a" value="Par" size="30"></span></div></div></div></div>`;
		const q = normalizeQuizQuestion({ slot: 3, type: "shortanswer", html });
		expect(q.body).toEqual({ kind: "text", field: "q9:3_answer", numeric: false, correctness: undefined });
		expect(q.fields).toEqual({ "q9:3_:sequencecheck": "1", "q9:3_answer": "Par" });
	});

	it("parses a numerical answer with a unit dropdown", () => {
		const html = `<div class="que numerical"><div class="content"><div class="formulation"><div class="qtext">Speed?</div><div class="ablock"><span class="answer"><input type="text" name="q9:4_answer" class="incorrect"><select name="q9:4_unit"><option value="0" selected>m/s</option><option value="1">km/h</option></select></span></div></div></div></div>`;
		const q = normalizeQuizQuestion({ slot: 4, type: "numerical", html });
		expect(q.body).toMatchObject({ kind: "text", numeric: true, correctness: "incorrect", unit: { field: "q9:4_unit", options: [{ value: "0", label: "m/s" }, { value: "1", label: "km/h" }] } });
		expect(q.fields["q9:4_unit"]).toBe("0");
	});

	it("parses matching rows", () => {
		const html = `<div class="que match"><div class="content"><div class="formulation"><div class="qtext">Match.</div><table class="answer"><tbody>
			<tr class="r0"><td class="text"><p>Cat</p></td><td class="control"><select name="q9:5_sub0"><option value="0">Choose...</option><option value="1" selected>Meow</option><option value="2">Woof</option></select></td></tr>
			<tr class="r1"><td class="text">Dog</td><td class="control correct"><select name="q9:5_sub1"><option value="0" selected>Choose...</option><option value="2">Woof</option></select></td></tr></tbody></table></div></div></div>`;
		const q = normalizeQuizQuestion({ slot: 5, type: "match", html });
		if (q.body.kind !== "match") throw new Error();
		expect(q.body.rows).toHaveLength(2);
		expect(q.body.rows[0]).toMatchObject({ field: "q9:5_sub0", stemHtml: "<p>Cat</p>" });
		expect(q.body.rows[1].correctness).toBe("correct");
		expect(q.fields).toMatchObject({ "q9:5_sub0": "1", "q9:5_sub1": "0" });
	});

	it("parses an essay with its format and detects attachments", () => {
		const html = `<div class="que essay"><div class="content"><div class="formulation"><div class="qtext">Discuss.</div><div class="ablock"><div class="answer"><textarea name="q9:6_answer" rows="15">&lt;p&gt;Hi&lt;/p&gt;</textarea><input type="hidden" name="q9:6_answerformat" value="1"></div><div class="attachments"><input type="hidden" name="q9:6_attachments" value="123"></div></div></div></div></div>`;
		const q = normalizeQuizQuestion({ slot: 6, type: "essay", html });
		expect(q.body).toMatchObject({ kind: "essay", field: "q9:6_answer", formatField: "q9:6_answerformat", format: 1, hasAttachments: true });
		expect(q.fields["q9:6_answer"]).toBe("<p>Hi</p>");
	});

	it("shows an essay response in review without a textarea", () => {
		const html = `<div class="que essay"><div class="content"><div class="formulation"><div class="qtext">Discuss.</div><div class="answer"><div class="qtype_essay_response readonly"><p>My answer</p></div></div></div></div></div>`;
		const q = normalizeQuizQuestion({ slot: 6, type: "essay", html }, { review: true });
		expect(q.body).toMatchObject({ kind: "essay", field: undefined, responseHtml: "<p>My answer</p>" });
	});

	it("treats descriptions as unnumbered and unsupported types as read-only", () => {
		const d = normalizeQuizQuestion({ slot: 7, type: "description", html: `<div class="que description"><div class="content"><div class="formulation"><div class="qtext">Read this.</div></div></div></div>`, number: 7 });
		expect(d.body.kind).toBe("description");
		expect(d.number).toBeUndefined();
		const u = normalizeQuizQuestion({ slot: 8, type: "ddwtos", html: `<div class="que ddwtos"><div class="qtext">Drag <span class="drop">x</span></div><input name="q9:8_p1" value="0"></div>` });
		expect(u.body.kind).toBe("unsupported");
		expect(u.fields).toEqual({});
	});

	it("falls back to unsupported when a supported type lacks its controls", () => {
		expect(normalizeQuizQuestion({ slot: 1, type: "multichoice", html: `<div class="que multichoice"><div class="qtext">Broken</div></div>` }).body.kind).toBe("unsupported");
	});

	it("marks locked controls read-only", () => {
		const html = `<div class="que shortanswer"><div class="qtext">Q</div><input type="text" name="q9:3_answer" value="x" readonly></div>`;
		expect(normalizeQuizQuestion({ slot: 3, type: "shortanswer", html }).readOnly).toBe(true);
	});
});

describe("mapQuestionState", () => {
	it("collapses Moodle states", () => {
		expect(["todo", "complete", "gradedright", "gradedpartial", "gradedwrong", "gaveup", "needsgrading", "weird"].map(mapQuestionState)).toEqual([
			"todo",
			"complete",
			"correct",
			"partial",
			"incorrect",
			"gaveup",
			"needsgrading",
			"other",
		]);
	});
});

describe("quiz metadata", () => {
	it("maps quizzes", () => {
		const [q] = normalizeQuizzes({ quizzes: [{ id: 3, coursemodule: 30, course: 1, name: "Quiz 1", timeopen: 0, timeclose: 1_800_000_000, timelimit: 1800, attempts: 2, grademethod: 4, grade: 10, navmethod: "sequential", decimalpoints: 1 }] });
		expect(q).toMatchObject({ id: 3, cmid: 30, courseId: 1, timeLimit: 1800, maxAttempts: 2, gradeMethod: "last", maxGrade: 10, navMethod: "sequential", decimalPoints: 1, hasQuestions: true });
		expect(q.timeOpen).toBeUndefined();
		expect(normalizeQuizzes({})).toEqual([]);
	});

	it("merges access information and detects the password rule", () => {
		const a = normalizeQuizAccess(
			{ canattempt: true, accessrules: ["Time limit: 30 mins"], preventaccessreasons: [], activerulenames: ["quizaccess_password"] },
			{ preventnewattemptreasons: ["No more attempts"] },
		);
		expect(a).toEqual({ canAttempt: true, canPreview: false, rules: ["Time limit: 30 mins"], blockedReasons: [], newAttemptBlockedReasons: ["No more attempts"], requiresPassword: true });
	});

	it("normalizes attempts, sorted by number, tolerating a missing state", () => {
		const list = normalizeQuizAttempts({
			attempts: [
				{ id: 2, quiz: 3, attempt: 2, uniqueid: 20, state: "inprogress", timestart: 100, timefinish: 0, sumgrades: null, currentpage: 1 },
				{ id: 1, quiz: 3, attempt: 1, uniqueid: 10, state: "finished", timestart: 50, timefinish: 90, sumgrades: 7.5 },
			],
		});
		expect(list.map((a) => a.id)).toEqual([1, 2]);
		expect(list[0]).toMatchObject({ state: "finished", sumGrades: 7.5, uniqueId: 10 });
		expect(list[1]).toMatchObject({ state: "inprogress", sumGrades: undefined, currentPage: 1 });
		expect(normalizeQuizAttempt({ id: 1, timefinish: 5 }).state).toBe("finished");
	});

	it("reads best grade, attempt access and review options", () => {
		expect(normalizeQuizBestGrade({ hasgrade: true, grade: 8.5 })).toEqual({ hasGrade: true, grade: 8.5 });
		expect(normalizeQuizBestGrade({ hasgrade: false }).hasGrade).toBe(false);
		expect(normalizeQuizAttemptAccess({ endtime: 0, isfinished: false })).toEqual({ endTime: undefined, isFinished: false });
		expect(normalizeQuizAttemptAccess({ endtime: 1_800_000_000 }).endTime).toBeDefined();
		const opts = normalizeQuizReviewOptions({ someoptions: [{ name: "attempt", value: 1 }, { name: "marks", value: 0 }, { name: "rightanswer", value: 1 }], alloptions: [] });
		expect(opts).toMatchObject({ attempt: true, marks: false, rightAnswer: true, overallFeedback: false });
	});
});

describe("attempt pages", () => {
	it("normalizes attempt data with parsed questions", () => {
		const page = normalizeQuizAttemptPage({
			attempt: { id: 5, quiz: 3, attempt: 1, uniqueid: 9, state: "inprogress", timestart: 100 },
			nextpage: 1,
			messages: [],
			questions: [{ slot: 1, type: "multichoice", page: 0, html: multichoice(), number: 1, state: "todo", flagged: false }],
		});
		expect(page.nextPage).toBe(1);
		expect(page.questions[0].flag?.qubaId).toBe(9);
	});

	it("builds the navigation summary", () => {
		const items = normalizeQuizSummary({
			questions: [
				{ slot: 1, type: "multichoice", page: 0, number: 1, state: "complete", status: "Answer saved", flagged: true },
				{ slot: 2, type: "description", page: 0, state: "todo", status: "" },
			],
		});
		expect(items[0]).toMatchObject({ number: "1", state: "complete", flagged: true, answerable: true });
		expect(items[1].answerable).toBe(false);
	});

	it("normalizes a review, hiding a false grade", () => {
		const review = normalizeQuizAttemptReview({
			grade: false,
			attempt: { id: 5, uniqueid: 9, state: "finished", timestart: 1, timefinish: 2 },
			additionaldata: [{ id: "timetaken", title: "Time taken", content: "<b>5 mins</b>" }, { id: "x", title: "Empty", content: "" }],
			questions: [{ slot: 1, type: "multichoice", html: multichoice(), state: "gradedwrong" }],
		});
		expect(review.grade).toBeUndefined();
		expect(review.summary).toEqual([{ label: "Time taken", value: "5 mins" }]);
		expect(review.questions[0]).toMatchObject({ state: "incorrect", readOnly: true });
		expect(normalizeQuizAttemptReview({ grade: "7.50", attempt: {}, questions: [] }).grade).toBe("7.50");
	});

	it("posts rendered fields with edits applied", () => {
		const q = normalizeQuizQuestion({ slot: 1, type: "multichoice", html: multichoice() });
		const u = normalizeQuizQuestion({ slot: 2, type: "ddwtos", html: "<div class='que ddwtos'></div>" });
		expect(quizAnswerData([q, u], { "q9:1_answer": "1" })).toEqual({ "q9:1_:sequencecheck": "3", "q9:1_answer": "1" });
	});
});

describe("isQuestionAnswered", () => {
	it("reads each body kind", () => {
		const choice = normalizeQuizQuestion({ slot: 1, type: "multichoice", html: multichoice() });
		expect(isQuestionAnswered(choice, choice.fields)).toBe(false);
		expect(isQuestionAnswered(choice, { ...choice.fields, "q9:1_answer": "1" })).toBe(true);
		expect(isQuestionAnswered(choice, { ...choice.fields, "q9:1_answer": "-1" })).toBe(false);
		const checks = normalizeQuizQuestion({ slot: 2, type: "multichoice", html: multi });
		expect(isQuestionAnswered(checks, checks.fields)).toBe(true);
		expect(isQuestionAnswered(checks, { ...checks.fields, "q9:2_choice0": "0" })).toBe(false);
		const essay = normalizeQuizQuestion({ slot: 6, type: "essay", html: `<div class="que essay"><textarea name="q9:6_answer"></textarea></div>` });
		expect(isQuestionAnswered(essay, { "q9:6_answer": "<p> </p>" })).toBe(false);
		expect(isQuestionAnswered(essay, { "q9:6_answer": "<p>x</p>" })).toBe(true);
	});
});

describe("demo quiz", () => {
	it("serves parseable attempts, reviews and submission", async () => {
		const api = createMockQuizApi();
		const quiz = await api.getQuiz(1, 3);
		expect(quiz).toMatchObject({ id: 3, navMethod: "free" });
		const attempts = await api.getQuizAttempts(3);
		expect(attempts.map((a) => a.state)).toEqual(["finished", "inprogress"]);

		const first = await api.getQuizAttemptPage(attempts[1].id, 0);
		expect(first.questions.map((q) => q.body.kind)).toEqual(["description", "choice", "choice"]);
		expect(first.questions[1].fields["q9002:2_answer"]).toBe("2");
		expect(first.questions[1].flag?.qubaId).toBe(9002);
		const last = await api.getQuizAttemptPage(attempts[1].id, 2);
		expect(last.questions.map((q) => q.body.kind)).toEqual(["match", "essay", "unsupported"]);
		expect(last.nextPage).toBe(-1);

		const review = await api.getQuizAttemptReview(attempts[0].id);
		expect(review.questions).toHaveLength(9);
		expect(Number(review.grade)).toBeGreaterThan(5);
		expect(review.questions.find((q) => q.qtype === "essay")?.feedback.some((f) => f.kind === "teacher")).toBe(true);

		expect(await api.processQuizAttempt(attempts[1].id, { "q9002:4_answer": "2x" }, { finish: true })).toBe("finished");
		const after = await api.getQuizAttemptReview(attempts[1].id);
		expect(after.questions.find((q) => q.slot === 4)?.state).toBe("correct");
	});
});
