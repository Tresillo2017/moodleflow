import {
	normalizeQuizAttemptAccess,
	normalizeQuizAttemptPage,
	normalizeQuizAttemptReview,
	normalizeQuizAttempts,
	normalizeQuizReviewOptions,
	normalizeQuizSummary,
	normalizeQuizzes,
	normalizeStartedAttempt,
} from "./normalize-quiz";
import type { QuizApi } from "./client-quiz";
import type { QuizBestGrade } from "@/types/quiz";

/**
 * Demo quiz: an in-memory "Moodle" that answers the quiz WS calls with the same raw shapes
 * (rendered question HTML included), so the real normalizers and UI are exercised.
 */

const wait = <T>(value: T, ms = 200): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const secs = (ms: number) => Math.floor(ms / 1000);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const now = Date.now();

const QUIZ_ID = 3;
const COURSE_ID = 1;
const TIME_LIMIT = 1800;
const MAX_GRADE = 10;
const MAX_ATTEMPTS = 3;
const PER_PAGE = 3;

type Responses = Record<string, string>;
type Mode = "edit" | "review";
type Verdict = "correct" | "partial" | "incorrect";

interface Def {
	slot: number;
	type: string;
	maxMark: number;
	text: string;
	render(p: string, resp: Responses, review: boolean): string;
	/** Fraction of the mark earned, or null when unanswered / needs manual grading. */
	grade(p: string, resp: Responses): number | null;
	answered(p: string, resp: Responses): boolean;
	rightAnswer?: string;
	generalFeedback?: string;
}

const verdictOf = (fraction: number | null): Verdict | undefined => (fraction === null ? undefined : fraction >= 1 ? "correct" : fraction > 0 ? "partial" : "incorrect");
const disabled = (review: boolean) => (review ? " disabled" : "");

/** Single choice (radio) rows; `correct` marks the right option in review. */
function radios(p: string, resp: Responses, review: boolean, options: [string, string][], correct: string, prompt = "Select one:"): string {
	const chosen = resp[`${p}answer`];
	const rows = options.map(([value, label], i) => {
		const mark = review && (value === correct ? " correct" : value === chosen ? " incorrect" : "");
		return `<div class="r${i % 2}${mark}"><input type="radio" name="${p}answer" value="${value}"${chosen === value ? " checked" : ""}${disabled(review)}><div class="d-flex w-auto"><span class="answernumber">${String.fromCharCode(97 + i)}. </span><div class="flex-fill ml-1">${label}</div></div></div>`;
	});
	return `<div class="ablock"><div class="prompt">${prompt}</div><div class="answer">${rows.join("")}<input type="radio" name="${p}answer" value="-1" class="sr-only"></div></div>`;
}

const DEFS: Def[] = [
	{
		slot: 1, type: "description", maxMark: 0, text: "<p>Answer all questions. You can flag questions to come back to them, and your answers are saved as you go.</p>",
		render: () => "", grade: () => null, answered: () => false,
	},
	{
		slot: 2, type: "multichoice", maxMark: 1, text: "<p>Which of these numbers is <strong>prime</strong>?</p>",
		render: (p, r, rev) => radios(p, r, rev, [["0", "4"], ["1", "9"], ["2", "11"], ["3", "15"]], "2"),
		grade: (p, r) => (r[`${p}answer`] && r[`${p}answer`] !== "-1" ? (r[`${p}answer`] === "2" ? 1 : 0) : null),
		answered: (p, r) => Boolean(r[`${p}answer`]) && r[`${p}answer`] !== "-1",
		rightAnswer: "The correct answer is: 11", generalFeedback: "<p>11 has no divisors other than 1 and itself.</p>",
	},
	{
		slot: 3, type: "truefalse", maxMark: 1, text: "<p>The harmonic series converges.</p>",
		render: (p, r, rev) => radios(p, r, rev, [["1", "True"], ["0", "False"]], "0"),
		grade: (p, r) => (r[`${p}answer`] && r[`${p}answer`] !== "-1" ? (r[`${p}answer`] === "0" ? 1 : 0) : null),
		answered: (p, r) => Boolean(r[`${p}answer`]) && r[`${p}answer`] !== "-1",
		rightAnswer: "The correct answer is 'False'.", generalFeedback: "<p>The partial sums of 1/n grow like ln n, without bound.</p>",
	},
	{
		slot: 4, type: "shortanswer", maxMark: 1, text: "<p>What is the derivative of <em>x</em><sup>2</sup> with respect to x?</p>",
		render: (p, r, rev) => {
			const value = r[`${p}answer`] ?? "";
			const mark = rev && value ? (value.replace(/\s/g, "") === "2x" ? " correct" : " incorrect") : "";
			return `<div class="ablock"><span class="answer"><label class="sr-only" for="${p}answer">Answer</label><input type="text" name="${p}answer" id="${p}answer" value="${esc(value)}" size="30" class="form-control d-inline${mark}"${disabled(rev)}></span></div>`;
		},
		grade: (p, r) => (r[`${p}answer`]?.trim() ? (r[`${p}answer`].replace(/\s/g, "") === "2x" ? 1 : 0) : null),
		answered: (p, r) => Boolean(r[`${p}answer`]?.trim()),
		rightAnswer: "The correct answer is: 2x",
	},
	{
		slot: 5, type: "numerical", maxMark: 1, text: "<p>Compute 12 &times; 1.5.</p>",
		render: (p, r, rev) => {
			const value = r[`${p}answer`] ?? "";
			const mark = rev && value ? (Math.abs(Number(value) - 18) < 0.01 ? " correct" : " incorrect") : "";
			return `<div class="ablock"><span class="answer"><input type="text" name="${p}answer" value="${esc(value)}" size="12" class="form-control d-inline${mark}"${disabled(rev)}></span></div>`;
		},
		grade: (p, r) => (r[`${p}answer`]?.trim() ? (Math.abs(Number(r[`${p}answer`]) - 18) < 0.01 ? 1 : 0) : null),
		answered: (p, r) => Boolean(r[`${p}answer`]?.trim()),
		rightAnswer: "The correct answer is: 18",
	},
	{
		slot: 6, type: "multichoice", maxMark: 1, text: "<p>Select <strong>all</strong> convergent series.</p>",
		render: (p, r, rev) => {
			const options = ["&sum; 1/n<sup>2</sup>", "&sum; 1/n", "&sum; 1/2<sup>n</sup>", "&sum; (&minus;1)<sup>n</sup>"];
			const rows = options.map((label, i) => {
				const on = r[`${p}choice${i}`] === "1";
				const right = i === 0 || i === 2;
				const mark = rev && (right ? " correct" : on ? " incorrect" : "");
				return `<div class="r${i % 2}${mark}"><input type="hidden" name="${p}choice${i}" value="0"><input type="checkbox" name="${p}choice${i}" value="1"${on ? " checked" : ""}${disabled(rev)}><label><span class="answernumber">${String.fromCharCode(97 + i)}. </span>${label}</label></div>`;
			});
			return `<div class="ablock"><div class="prompt">Select one or more:</div><div class="answer">${rows.join("")}</div></div>`;
		},
		grade: (p, r) => {
			const picked = [0, 1, 2, 3].filter((i) => r[`${p}choice${i}`] === "1");
			if (picked.length === 0) return null;
			const good = picked.filter((i) => i === 0 || i === 2).length;
			const bad = picked.length - good;
			return Math.max(0, (good - bad) / 2);
		},
		answered: (p, r) => [0, 1, 2, 3].some((i) => r[`${p}choice${i}`] === "1"),
		rightAnswer: "The correct answers are: &sum; 1/n<sup>2</sup>, &sum; 1/2<sup>n</sup>",
	},
	{
		slot: 7, type: "match", maxMark: 1, text: "<p>Match each function with its derivative.</p>",
		render: (p, r, rev) => {
			const stems = ["sin x", "e<sup>x</sup>", "ln x"];
			const answers = ["cos x", "e<sup>x</sup>", "1/x"];
			const rows = stems.map((stem, i) => {
				const chosen = r[`${p}sub${i}`] ?? "0";
				const mark = rev && chosen !== "0" ? (chosen === String(i + 1) ? " correct" : " incorrect") : "";
				const opts = ["Choose...", ...answers].map((a, v) => `<option value="${v}"${chosen === String(v) ? " selected" : ""}>${a.replace(/<[^>]+>/g, "")}</option>`);
				return `<tr class="r${i % 2}"><td class="text"><p>${stem}</p></td><td class="control${mark}"><select name="${p}sub${i}"${disabled(rev)}>${opts.join("")}</select></td></tr>`;
			});
			return `<table class="answer"><tbody>${rows.join("")}</tbody></table>`;
		},
		grade: (p, r) => {
			const hits = [0, 1, 2].filter((i) => r[`${p}sub${i}`] === String(i + 1)).length;
			return [0, 1, 2].some((i) => r[`${p}sub${i}`] && r[`${p}sub${i}`] !== "0") ? hits / 3 : null;
		},
		answered: (p, r) => [0, 1, 2].some((i) => r[`${p}sub${i}`] && r[`${p}sub${i}`] !== "0"),
		rightAnswer: "sin x &rarr; cos x, e<sup>x</sup> &rarr; e<sup>x</sup>, ln x &rarr; 1/x",
	},
	{
		slot: 8, type: "essay", maxMark: 2, text: "<p>Explain in your own words why the ratio test is inconclusive when the limit equals 1.</p>",
		render: (p, r, rev) => {
			const value = r[`${p}answer`] ?? "";
			if (rev) return `<div class="ablock"><div class="answer"><div class="qtype_essay_response readonly">${value || "<p><em>No response.</em></p>"}</div></div></div>`;
			return `<div class="ablock"><div class="answer"><textarea name="${p}answer" rows="10">${esc(value)}</textarea><input type="hidden" name="${p}answerformat" value="1"></div></div>`;
		},
		grade: () => null, // graded by hand
		answered: (p, r) => Boolean(r[`${p}answer`]?.replace(/<[^>]*>/g, "").trim()),
	},
	{
		slot: 9, type: "ddwtos", maxMark: 1, text: `<p>The series <span class="place1 drop">____</span> converges when the terms <span class="place2 drop">____</span> to zero.</p><p><em>Drag-and-drop question: answer it in Moodle.</em></p>`,
		render: () => "", grade: () => null, answered: () => false,
	},
];

const TOTAL_MARKS = DEFS.reduce((sum, d) => sum + d.maxMark, 0);
const numberOf = (d: Def) => String(DEFS.filter((x) => x.type !== "description" && x.slot <= d.slot).length);
const pageOf = (d: Def) => Math.floor((d.slot - 1) / PER_PAGE);
const LAST_PAGE = pageOf(DEFS[DEFS.length - 1]);

interface MockAttempt {
	id: number;
	uniqueId: number;
	number: number;
	state: "inprogress" | "finished";
	timeStart: number;
	timeFinish?: number;
	currentPage: number;
	responses: Responses;
	flagged: Set<number>;
	manual: Record<number, { mark: number; comment: string }>;
}

const prefix = (a: MockAttempt, d: Def) => `q${a.uniqueId}:${d.slot}_`;
const earned = (a: MockAttempt, d: Def) => {
	const manual = a.manual[d.slot];
	if (manual) return manual.mark;
	const fraction = d.grade(prefix(a, d), a.responses);
	return fraction === null ? null : fraction * d.maxMark;
};
const sumGrades = (a: MockAttempt) => DEFS.reduce((sum, d) => sum + (earned(a, d) ?? 0), 0);
const gradeOf = (a: MockAttempt) => (sumGrades(a) / TOTAL_MARKS) * MAX_GRADE;

const attempts: MockAttempt[] = [
	{
		id: 501, uniqueId: 9001, number: 1, state: "finished", timeStart: now - 3 * 86_400_000, timeFinish: now - 3 * 86_400_000 + 14 * 60_000, currentPage: 0, flagged: new Set(),
		responses: {
			"q9001:2_answer": "2", "q9001:3_answer": "1", "q9001:4_answer": "2x", "q9001:5_answer": "18",
			"q9001:6_choice0": "1", "q9001:6_choice1": "0", "q9001:6_choice2": "0", "q9001:6_choice3": "0",
			"q9001:7_sub0": "1", "q9001:7_sub1": "2", "q9001:7_sub2": "1",
			"q9001:8_answer": "<p>The ratio test compares consecutive terms; at a limit of 1 the terms shrink too slowly to tell convergence from divergence (compare 1/n and 1/n<sup>2</sup>).</p>",
		},
		manual: { 8: { mark: 1.5, comment: "<p>Good reasoning; mention the p-series comparison next time.</p>" } },
	},
	{
		id: 502, uniqueId: 9002, number: 2, state: "inprogress", timeStart: now - 5 * 60_000, currentPage: 0, flagged: new Set([3]),
		responses: { "q9002:2_answer": "2" },
		manual: {},
	},
];
let nextAttemptId = 503;

const find = (id: number) => {
	const a = attempts.find((x) => x.id === id);
	if (!a) throw new Error("Unknown attempt");
	return a;
};
const endTimeOf = (a: MockAttempt) => a.timeStart + TIME_LIMIT * 1000;

const rawAttempt = (a: MockAttempt) => ({
	id: a.id, quiz: QUIZ_ID, userid: 1, attempt: a.number, uniqueid: a.uniqueId, state: a.state, currentpage: a.currentPage,
	timestart: secs(a.timeStart), timefinish: a.timeFinish ? secs(a.timeFinish) : 0, sumgrades: a.state === "finished" ? sumGrades(a) : null, preview: 0,
});

const STATE_FOR: Record<Verdict, string> = { correct: "gradedright", partial: "gradedpartial", incorrect: "gradedwrong" };

function questionHtml(a: MockAttempt, d: Def, mode: Mode): string {
	const p = prefix(a, d);
	const review = mode === "review";
	const points = earned(a, d);
	const verdict = verdictOf(points === null ? null : points / d.maxMark);
	const flag = review ? "" : `<div class="questionflag editable"><input type="hidden" name="${p}:flagged" value="0"><input type="checkbox" name="${p}:flagged" value="1" class="questionflagcheckbox"><input type="hidden" value="qaid=${a.uniqueId * 100 + d.slot}&amp;qubaid=${a.uniqueId}&amp;questionid=${d.slot}&amp;newstate=0&amp;slot=${d.slot}&amp;checksum=demo&amp;sesskey=demo" class="questionflagpostdata"></div>`;
	const feedback = review
		? [d.generalFeedback && `<div class="generalfeedback">${d.generalFeedback}</div>`, d.rightAnswer && verdict !== "correct" && `<div class="rightanswer">${d.rightAnswer}</div>`].filter(Boolean).join("")
		: "";
	const comment = review && a.manual[d.slot] ? `<div class="comment clearfix"><div class="comment">${a.manual[d.slot].comment}</div></div>` : "";
	return `<div class="que ${d.type} deferredfeedback"><div class="info">${flag}</div><div class="content"><div class="formulation clearfix"><input type="hidden" name="${p}:sequencecheck" value="1"><div class="qtext">${d.text}</div>${d.render(p, a.responses, review)}</div>${feedback ? `<div class="outcome clearfix"><div class="feedback">${feedback}</div></div>` : ""}${comment}</div></div>`;
}

function rawQuestion(a: MockAttempt, d: Def, mode: Mode) {
	const p = prefix(a, d);
	const review = mode === "review";
	const points = earned(a, d);
	const verdict = verdictOf(points === null ? null : points / d.maxMark);
	const answered = d.answered(p, a.responses);
	const base = { slot: d.slot, type: d.type, page: pageOf(d), html: questionHtml(a, d, mode), flagged: a.flagged.has(d.slot), ...(d.type !== "description" && { number: numberOf(d) }) };
	if (d.type === "description") return { ...base, state: "todo", status: "" };
	const state = review ? (verdict ? STATE_FOR[verdict] : answered && d.type === "essay" ? "needsgrading" : "gaveup") : answered ? "complete" : "todo";
	const status = review ? (verdict ? { correct: "Correct", partial: "Partially correct", incorrect: "Incorrect" }[verdict] : state === "needsgrading" ? "Requires grading" : "Not answered") : answered ? "Answer saved" : "Not yet answered";
	return { ...base, state, status, maxmark: d.maxMark.toFixed(2), ...(review && points !== null && { mark: points.toFixed(2) }) };
}

const formatDuration = (ms: number) => `${Math.max(1, Math.round(ms / 60_000))} mins`;
const shortDate = (ms: number) => new Date(ms).toLocaleString();

const finished = () => attempts.filter((x) => x.state === "finished");
const bestGrade = (): QuizBestGrade => (finished().length ? { hasGrade: true, grade: Math.max(...finished().map(gradeOf)) } : { hasGrade: false });

const gradeFeedback = (grade: number) =>
	grade >= 9 ? "<p>Excellent work!</p>" : grade >= 5 ? "<p>Good job. Review the topics you missed before the midterm.</p>" : "<p>Please revisit this week's material and try again.</p>";

const quizRaw = {
	id: QUIZ_ID, coursemodule: 3, course: COURSE_ID, name: "Quiz 1", intro: "<p>Ten minutes of calculus warm-up. Three attempts, highest grade counts.</p>",
	timeopen: 0, timeclose: secs(now + 14 * 86_400_000), timelimit: TIME_LIMIT, attempts: MAX_ATTEMPTS, grademethod: 1, grade: MAX_GRADE, sumgrades: TOTAL_MARKS,
	navmethod: "free", questionsperpage: PER_PAGE, decimalpoints: 2, hasquestions: 1,
};

export function createMockQuizApi(): QuizApi {
	return {
		getQuiz: (courseId, quizId) => wait(normalizeQuizzes({ quizzes: courseId === COURSE_ID ? [quizRaw] : [] }).find((q) => q.id === quizId)),

		getQuizAccess: () => {
			const usedUp = finished().length >= MAX_ATTEMPTS && !attempts.some((a) => a.state === "inprogress");
			return wait({
				canAttempt: true, canPreview: false, requiresPassword: false, blockedReasons: [],
				newAttemptBlockedReasons: usedUp ? ["You have no more attempts left."] : [],
				rules: ["Time limit: 30 mins", `Attempts allowed: ${MAX_ATTEMPTS}`, "Grading method: Highest grade"],
			});
		},

		getQuizAttempts: () => wait(normalizeQuizAttempts({ attempts: attempts.map(rawAttempt) })),
		getQuizBestGrade: () => wait(bestGrade()),
		getQuizFeedback: (_quizId, grade) => wait(gradeFeedback(grade)),
		getQuizRequiredQtypes: () => wait(["multichoice", "truefalse", "shortanswer", "numerical", "match", "essay", "ddwtos"]),
		getQuizReviewOptions: () =>
			wait(normalizeQuizReviewOptions({ someoptions: ["attempt", "correctness", "marks", "specificfeedback", "generalfeedback", "rightanswer", "overallfeedback"].map((name) => ({ name, value: 1 })) })),

		async startQuizAttempt() {
			if (attempts.some((a) => a.state === "inprogress")) throw new Error("An attempt is already in progress.");
			const id = nextAttemptId++;
			const a: MockAttempt = { id, uniqueId: 9000 + id - 500, number: attempts.length + 1, state: "inprogress", timeStart: Date.now(), currentPage: 0, responses: {}, flagged: new Set(), manual: {} };
			attempts.push(a);
			return wait(normalizeStartedAttempt({ attempt: rawAttempt(a) }));
		},

		getQuizAttemptAccess: (_quizId, attemptId) => {
			const a = find(attemptId);
			return wait(normalizeQuizAttemptAccess({ endtime: a.state === "inprogress" ? secs(endTimeOf(a)) : 0, isfinished: a.state === "finished" }), 100);
		},

		getQuizAttemptPage(attemptId, page) {
			const a = find(attemptId);
			a.currentPage = page;
			return wait(
				normalizeQuizAttemptPage({
					attempt: rawAttempt(a),
					nextpage: page >= LAST_PAGE ? -1 : page + 1,
					messages: [],
					questions: DEFS.filter((d) => pageOf(d) === page).map((d) => rawQuestion(a, d, "edit")),
				}),
			);
		},

		getQuizAttemptSummary(attemptId) {
			const a = find(attemptId);
			return wait(normalizeQuizSummary({ questions: DEFS.map((d) => rawQuestion(a, d, "edit")) }), 100);
		},

		async saveQuizAttempt(attemptId, data) {
			Object.assign(find(attemptId).responses, data);
			return wait(undefined, 80);
		},

		async processQuizAttempt(attemptId, data, opts = {}) {
			const a = find(attemptId);
			Object.assign(a.responses, data);
			if (opts.finish) {
				a.state = "finished";
				a.timeFinish = Date.now();
			}
			return wait(a.state, 150);
		},

		async setQuizQuestionFlag(target, flagged) {
			const a = attempts.find((x) => x.uniqueId === target.qubaId);
			if (a) flagged ? a.flagged.add(target.slot) : a.flagged.delete(target.slot);
			return wait(undefined, 80);
		},

		getQuizAttemptReview(attemptId) {
			const a = find(attemptId);
			const done = a.timeFinish ?? Date.now();
			return wait(
				normalizeQuizAttemptReview({
					grade: gradeOf(a).toFixed(2),
					attempt: rawAttempt(a),
					additionaldata: [
						{ id: "startedon", title: "Started on", content: shortDate(a.timeStart) },
						{ id: "state", title: "State", content: "Finished" },
						{ id: "completedon", title: "Completed on", content: shortDate(done) },
						{ id: "timetaken", title: "Time taken", content: formatDuration(done - a.timeStart) },
						{ id: "marks", title: "Marks", content: `${sumGrades(a).toFixed(2)}/${TOTAL_MARKS.toFixed(2)}` },
						{ id: "grade", title: "Grade", content: `${gradeOf(a).toFixed(2)} out of ${MAX_GRADE.toFixed(2)} (${Math.round((gradeOf(a) / MAX_GRADE) * 100)}%)` },
					],
					questions: DEFS.map((d) => rawQuestion(a, d, "review")),
				}),
			);
		},

		logQuizAttemptReview: () => wait(undefined, 0),
	};
}
