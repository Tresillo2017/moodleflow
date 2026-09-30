import { MoodleError } from "@/types/moodle";
import { LESSON_EOL } from "@/types/lesson";
import type { LessonApi } from "./client-lesson";
import type { LessonAnswer, LessonInfo, LessonInput, LessonMatchPair, LessonPage, LessonPageKind, LessonPageResult } from "@/types/lesson";

const wait = <T>(value: T, ms = 200): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));

const lessons: LessonInfo[] = [
	{
		id: 1, cmid: 21, courseId: 1, name: "Series and convergence: guided lesson", intro: "<p>A short branching lesson. Skip ahead if you already know limits.</p>",
		timeLimit: 0, maxAttempts: 0, retake: true, review: true, practice: false, progressBar: true, ongoingScore: true, passwordRequired: false, grade: 10,
	},
	{
		id: 2, cmid: 22, courseId: 1, name: "Locked lesson (password: demo)", intro: "<p>Same pages, behind a password.</p>",
		timeLimit: 0, maxAttempts: 1, retake: false, review: false, practice: true, progressBar: false, ongoingScore: false, passwordRequired: true, grade: 0,
	},
];
const PASSWORD = "demo";

interface MockPage {
	id: number;
	title: string;
	kind: LessonPageKind;
	contents: string;
	answers?: (LessonAnswer & { correct?: boolean })[];
	multiple?: boolean;
	pairs?: LessonMatchPair[];
	/** Correct text answers, lowercase. */
	accepted?: string[];
	/** Wrong answers send the learner back to the same page this many times. */
	retries?: number;
}

const yes = (id: number, text: string, correct = false) => ({ id, text, jumpTo: -1, correct });
const pages: MockPage[] = [
	{
		id: 1, title: "Welcome", kind: "content", contents: "<p>Welcome! This lesson covers <strong>series convergence</strong>. Pick where to start.</p>",
		answers: [{ id: 101, text: "Start with limits", jumpTo: 2 }, { id: 102, text: "I know limits, skip to series", jumpTo: 4 }],
	},
	{
		id: 2, title: "Limits refresher", kind: "content", contents: "<p>A sequence <em>converges</em> when its terms approach a single value. For example <code>1/n</code> tends to 0.</p>",
		answers: [{ id: 103, text: "Continue", jumpTo: -1 }],
	},
	{
		id: 3, title: "Check: limits", kind: "truefalse", contents: "<p>The sequence <code>1/n</code> converges to 0.</p>",
		answers: [yes(104, "True", true), yes(105, "False")],
	},
	{
		id: 4, title: "Inconclusive ratio test", kind: "multichoice", multiple: false, retries: 1,
		contents: "<p>Which value of the limit <code>L = lim |a(n+1)/a(n)|</code> makes the ratio test inconclusive?</p>",
		answers: [yes(106, "L = 0"), yes(107, "L = 1", true), yes(108, "L = 2")],
	},
	{
		id: 5, title: "Pick the convergent series", kind: "multichoice", multiple: true,
		contents: "<p>Select <strong>all</strong> series that converge.</p>",
		answers: [yes(109, "Sum of 1/n^2", true), yes(110, "Sum of 1/n"), yes(111, "Sum of 1/2^n", true)],
	},
	{
		id: 6, title: "Name that sum", kind: "shortanswer", accepted: ["basel", "basel problem"],
		contents: "<p>The value of the sum of <code>1/n^2</code> is <code>pi^2/6</code>. What is this result called? (One or two words.)</p>",
	},
	{
		id: 7, title: "Match the tests", kind: "matching",
		contents: "<p>Match each test with the series it decides most directly.</p>",
		pairs: [
			{ id: 112, prompt: "Integral test", options: ["Sum of 1/n^p", "Sum of n!/n^n", "Alternating series"].map((v) => ({ value: v, label: v })) },
			{ id: 113, prompt: "Ratio test", options: ["Sum of 1/n^p", "Sum of n!/n^n", "Alternating series"].map((v) => ({ value: v, label: v })) },
		],
	},
	{
		id: 8, title: "Reflection", kind: "essay",
		contents: "<p>In a few sentences, explain why the harmonic series diverges even though its terms tend to 0.</p>",
	},
];
const CORRECT_MATCH: Record<number, string> = { 112: "Sum of 1/n^p", 113: "Sum of n!/n^n" };
const QUESTIONS = pages.filter((p) => p.kind !== "content" && p.kind !== "essay").length;

interface Attempt {
	visited: number[];
	answers: Map<number, string>;
	tries: Map<number, number>;
	correct: number;
	answered: number;
	lastPage: number;
	finished: boolean;
}
const newAttempt = (): Attempt => ({ visited: [], answers: new Map(), tries: new Map(), correct: 0, answered: 0, lastPage: 1, finished: false });
let attempt: Attempt | null = null;
let attempts = 0;
let lastGrade: number | null = null;

const strip = (html: string) => html.replace(/<[^>]*>/g, "");
const pageOf = (id: number) => pages.find((p) => p.id === id);
const nextOf = (id: number) => pages[pages.findIndex((p) => p.id === id) + 1]?.id ?? 0;
const prevOf = (id: number) => pages[pages.findIndex((p) => p.id === id) - 1]?.id ?? 0;
const lessonOf = (id: number) => lessons.find((l) => l.id === id) ?? lessons[0];

function checkPassword(lessonId: number, password?: string) {
	if (lessonOf(lessonId).passwordRequired && password !== PASSWORD) throw new MoodleError("access_denied", "That password is incorrect.", "passwordisincorrect");
}

function toPage(p: MockPage, review: boolean): LessonPage {
	const given = attempt?.answers.get(p.id);
	return {
		id: p.id, title: p.title, kind: p.kind, typeId: 0, contents: p.contents,
		rendered: review ? `${p.contents}${given ? `<p><em>Your answer:</em> ${given}</p>` : ""}` : "",
		prevId: prevOf(p.id), nextId: nextOf(p.id),
		answers: (p.answers ?? []).map(({ id, text, jumpTo }) => ({ id, text, jumpTo })),
		multiple: Boolean(p.multiple), pairs: p.pairs ?? [], formFields: {},
		ongoingScore: attempt ? `${attempt.correct} / ${attempt.answered}` : undefined,
		progress: Math.round(((attempt?.visited.filter((v) => v !== p.id).length ?? 0) / pages.length) * 100),
		messages: [],
	};
}

function judge(p: MockPage, input: LessonInput): { correct: boolean; answer: string } {
	switch (p.kind) {
		case "truefalse":
		case "multichoice": {
			if (p.multiple) {
				const chosen = new Set(input.choices ?? []);
				const right = (p.answers ?? []).filter((a) => a.correct).map((a) => a.id);
				return { correct: right.length === chosen.size && right.every((id) => chosen.has(id)), answer: (p.answers ?? []).filter((a) => chosen.has(a.id)).map((a) => a.text).join(", ") };
			}
			const picked = p.answers?.find((a) => a.id === input.choice);
			return { correct: Boolean(picked?.correct), answer: picked?.text ?? "" };
		}
		case "shortanswer": {
			const text = (input.text ?? "").trim();
			return { correct: p.accepted?.includes(text.toLowerCase()) ?? false, answer: text };
		}
		case "matching": {
			const m = input.matches ?? {};
			return { correct: (p.pairs ?? []).every((pair) => m[pair.id] === CORRECT_MATCH[pair.id]), answer: (p.pairs ?? []).map((pair) => `${strip(pair.prompt)} → ${m[pair.id] ?? "?"}`).join("; ") };
		}
		default:
			return { correct: false, answer: (input.text ?? "").trim() };
	}
}

function submit(page: LessonPage, input: LessonInput): LessonPageResult {
	const p = pageOf(page.id);
	const a = attempt ?? (attempt = newAttempt());
	const result = (over: Partial<LessonPageResult>): LessonPageResult => ({
		newPageId: 0, correct: false, noAnswer: false, essay: false, attemptsRemaining: 0, maxAttemptsReached: false, messages: [],
		ongoingScore: `${a.correct} / ${a.answered}`, progress: Math.round((new Set(a.visited).size / pages.length) * 100), ...over,
	});
	if (!p) return result({ newPageId: LESSON_EOL });
	if (a.visited.at(-1) !== p.id) a.visited.push(p.id);
	a.lastPage = p.id;

	if (p.kind === "content") {
		const jump = input.jumpTo ?? -1;
		return result({ newPageId: jump === -1 ? nextOf(p.id) || LESSON_EOL : jump });
	}
	const onward = nextOf(p.id) || LESSON_EOL;
	if (p.kind === "essay") {
		a.answers.set(p.id, strip(input.text ?? ""));
		return result({ newPageId: onward, essay: true, feedback: "<p>Your response has been saved and will be graded by your teacher.</p>" });
	}
	const { correct, answer } = judge(p, input);
	const tries = (a.tries.get(p.id) ?? 0) + 1;
	a.tries.set(p.id, tries);
	const retry = !correct && tries <= (p.retries ?? 0);
	a.answers.set(p.id, answer);
	if (!retry) {
		a.answered += 1;
		if (correct) a.correct += 1;
	}
	return result({
		newPageId: retry ? 0 : onward,
		correct,
		attemptsRemaining: retry ? (p.retries ?? 0) - tries + 1 : 0,
		ongoingScore: `${a.correct} / ${a.answered}`,
		feedback: correct ? "<p>That's right.</p>" : retry ? "<p>Not quite. Have another go.</p>" : "<p>That's not the expected answer.</p>",
	});
}

export function createMockLessonApi(): LessonApi {
	return {
		getLessons: (courseId) => wait(lessons.filter((l) => l.courseId === courseId)),

		getLessonAccess: (lessonId) => wait({ canManage: false, blocked: [], attempts: lessonId === 1 ? attempts : 0, firstPageId: 1, lastPageSeen: attempt && !attempt.finished ? attempt.lastPage : undefined }, 100),

		getLessonOutline: () => wait(pages.map((p) => ({ id: p.id, title: p.title, kind: p.kind, prevId: prevOf(p.id), nextId: nextOf(p.id) })), 100),

		async launchLesson(lessonId, options) {
			checkPassword(lessonId, options?.password);
			if (options?.review) return wait([], 100);
			const resume = attempt && !attempt.finished;
			if (!resume) attempt = newAttempt();
			return wait(resume ? ["You are continuing your last attempt."] : [], 100);
		},

		async getLessonPage(lessonId, pageId, options) {
			checkPassword(lessonId, options?.password);
			const p = pageOf(pageId);
			if (!p) throw new MoodleError("unknown_error", "That lesson page doesn't exist.");
			if (attempt && !options?.review && !attempt.visited.includes(p.id)) attempt.lastPage = p.id;
			return wait(toPage(p, Boolean(options?.review)), 150);
		},

		submitLessonPage: (_lessonId, page, input) => wait(submit(page, input), 150),

		async finishLesson(lessonId) {
			const a = attempt ?? newAttempt();
			a.finished = true;
			attempts += 1;
			const grade = lessonOf(lessonId).grade;
			lastGrade = grade ? Math.round((a.correct / QUESTIONS) * grade * 10) / 10 : null;
			return wait({
				messages: ["<p>Congratulations, you reached the end of the lesson.</p>"],
				results: [
					{ label: "Questions answered", value: String(a.answered) },
					{ label: "Correct answers", value: String(a.correct) },
					...(lastGrade != null ? [{ label: "Your grade", value: `${lastGrade} / ${grade}` }] : []),
				],
			});
		},

		getLessonGrade: () => wait({ grade: lastGrade, formatted: lastGrade == null ? undefined : String(lastGrade) }, 100),
	};
}
