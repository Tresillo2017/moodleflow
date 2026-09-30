import type { EngageApi } from "./client-engage";
import type { Choice, ChoiceOption, ChoiceResult, Feedback, FeedbackItem, FeedbackPage, FeedbackResponseValue, Survey, SurveyQuestion } from "@/types/engage";

const wait = <T>(value: T, ms = 200): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const ME = { userId: 1, fullName: "Tomas" };
const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString();

// ---- choice ----
const choices: Choice[] = [
	{ id: 1, cmid: 30, courseId: 1, name: "Choose the exam date", intro: "<p>Vote for the day that suits you best. You can change your vote until the poll closes.</p>", publishNames: true, showResults: 1, allowUpdate: true, allowMultiple: false, timeClose: iso(10) },
	{ id: 2, cmid: 31, courseId: 1, name: "Topics to revise (pick up to two)", intro: "<p>Results are anonymous and always visible.</p>", publishNames: false, showResults: 3, allowUpdate: false, allowMultiple: true },
];
const choiceOptions = new Map<number, { id: number; text: string; maxAnswers: number; others: string[] }[]>([
	[1, [
		{ id: 11, text: "Monday, 9:00", maxAnswers: 0, others: ["Ana Costa", "Rui Ferreira"] },
		{ id: 12, text: "Wednesday, 14:00", maxAnswers: 2, others: ["Marta Lopes", "Prof. Silva"] },
		{ id: 13, text: "Friday, 10:00", maxAnswers: 0, others: [] },
	]],
	[2, [
		{ id: 21, text: "Series", maxAnswers: 0, others: ["Ana Costa", "Rui Ferreira", "Marta Lopes"] },
		{ id: 22, text: "Integrals", maxAnswers: 0, others: ["Ana Costa"] },
		{ id: 23, text: "Differential equations", maxAnswers: 0, others: ["Rui Ferreira"] },
	]],
]);
const myVotes = new Map<number, number[]>();

function optionsFor(choiceId: number): ChoiceOption[] {
	const mine = myVotes.get(choiceId) ?? [];
	return (choiceOptions.get(choiceId) ?? []).map((o) => {
		const count = o.others.length + (mine.includes(o.id) ? 1 : 0);
		return { id: o.id, text: o.text, maxAnswers: o.maxAnswers, count, checked: mine.includes(o.id), disabled: o.maxAnswers > 0 && count >= o.maxAnswers && !mine.includes(o.id) };
	});
}

function resultsFor(choiceId: number): ChoiceResult[] {
	const choice = choices.find((c) => c.id === choiceId);
	const mine = myVotes.get(choiceId) ?? [];
	const options = choiceOptions.get(choiceId) ?? [];
	const total = options.reduce((n, o) => n + o.others.length + (mine.includes(o.id) ? 1 : 0), 0);
	return options.map((o) => {
		const voters = [...o.others.map((fullName, i) => ({ userId: 100 + i, fullName })), ...(mine.includes(o.id) ? [ME] : [])];
		return { id: o.id, text: o.text, votes: voters.length, percent: total ? Math.round((voters.length / total) * 1000) / 10 : 0, voters: choice?.publishNames ? voters : [] };
	});
}

// ---- feedback ----
const feedbacks: Feedback[] = [
	{ id: 1, cmid: 32, courseId: 1, name: "Mid-course feedback", intro: "<p>Tell us how the course is going. It takes two minutes and your answers are anonymous.</p>", anonymous: true, multipleSubmit: true, publishStats: true, completionMessage: "<p><strong>Thanks!</strong> Your feedback helps shape the second half of the course.</p>" },
];
const item = (id: number, type: FeedbackItem["type"], name: string, extra: Partial<FeedbackItem> = {}): FeedbackItem => ({ id, type, rawType: type, name, required: false, dependItem: 0, dependValue: "", ...extra });
const opts = (...labels: string[]) => labels.map((label, i) => ({ value: i + 1, label }));
const feedbackPages: FeedbackItem[][] = [
	[
		item(1, "label", "", { html: "<h3>About you</h3><p>A few quick questions first.</p>" }),
		item(2, "textfield", "What is your name (optional)?", { maxLength: 40 }),
		item(3, "multichoice", "How do you usually study?", { required: true, style: "radio", choices: opts("Alone", "With a group", "Mostly during lectures") }),
		item(4, "textarea", "What makes group study work for you?", { dependItem: 3, dependValue: "2" }),
		item(5, "numeric", "Hours per week spent on this course", { min: 0, max: 60 }),
	],
	[
		item(6, "multichoice", "Which materials do you use?", { style: "check", choices: opts("Slides", "Recordings", "Textbook", "Practice quizzes") }),
		item(7, "multichoice", "Overall satisfaction", { required: true, style: "dropdown", choices: opts("Very poor", "Poor", "Fine", "Good", "Excellent"), rawType: "multichoicerated" }),
		item(8, "info", "Submitted on", { infoKind: 1 }),
	],
	[
		item(9, "textarea", "Anything else you would like to tell us?"),
		item(10, "captcha", "Type the characters you see", { required: true, rawType: "captcha" }),
	],
];
const savedAnswers = new Map<string, string>();
let finished: FeedbackResponseValue[] = [];

function finishedFromSaved(): FeedbackResponseValue[] {
	const out: FeedbackResponseValue[] = [];
	for (const it of feedbackPages.flat()) {
		if (it.type === "label" || it.type === "captcha") continue;
		const entries = [...savedAnswers].filter(([name]) => name === `${it.rawType}_${it.id}` || name.startsWith(`${it.rawType}_${it.id}[`));
		if (!entries.length) continue;
		const labelOf = (v: string) => it.choices?.find((c) => String(c.value) === v)?.label ?? v;
		out.push({ id: it.id, name: it.name, value: entries.map(([, v]) => labelOf(v)).filter((v) => v !== "0").join(", ") });
	}
	return out;
}

// ---- survey ----
const surveys: Survey[] = [{ id: 1, cmid: 33, courseId: 1, name: "Course experience survey", intro: "<p>A short survey about how you experience learning online.</p>", done: false }];
const scale = ["Almost never", "Seldom", "Sometimes", "Often", "Almost always"];
const surveyQuestions: SurveyQuestion[] = [
	{ id: 1, text: "Relevance", kind: "header", intro: "<p>In this online course...</p>", options: scale, actual: true, preferred: true, isSub: false },
	{ id: 2, text: "my learning focuses on issues that interest me.", kind: "scale", options: scale, actual: true, preferred: true, isSub: true },
	{ id: 3, text: "what I learn is important for my professional practice.", kind: "scale", options: scale, actual: true, preferred: true, isSub: true },
	{ id: 4, text: "I feel able to ask questions of the tutor.", kind: "scale", options: scale, actual: true, preferred: false, isSub: false },
	{ id: 5, text: "What is one thing that would improve this course?", kind: "text", options: [], actual: true, preferred: false, isSub: false },
];

const feedbackAnalysis = () => ({
	completedCount: 12,
	items: [
		{ id: 3, name: "How do you usually study?", type: "multichoice", choices: [{ label: "Alone", count: 5, percent: 41.7 }, { label: "With a group", count: 6, percent: 50 }, { label: "Mostly during lectures", count: 1, percent: 8.3 }], texts: [], stats: [] },
		{ id: 5, name: "Hours per week spent on this course", type: "numeric", choices: [], texts: [], stats: [{ label: "average", value: "6.5" }] },
		{ id: 9, name: "Anything else you would like to tell us?", type: "textarea", choices: [], texts: ["More worked examples, please.", "The recordings are great."], stats: [] },
	],
});

export function createMockEngageApi(): EngageApi {
	return {
		getChoices: (courseId) => wait(choices.filter((c) => c.courseId === courseId)),
		getChoiceOptions: (choiceId) => wait(optionsFor(choiceId)),
		getChoiceResults: (choiceId) => wait(resultsFor(choiceId)),
		submitChoice: (choiceId, optionIds) => {
			myVotes.set(choiceId, optionIds);
			return wait(undefined);
		},
		deleteChoiceResponses: (choiceId) => {
			myVotes.delete(choiceId);
			return wait(undefined);
		},

		getFeedbacks: (courseId) => wait(feedbacks.filter((f) => f.courseId === courseId)),
		getFeedbackAccess: () => wait({ canComplete: true, canSubmit: true, canViewAnalysis: true, canViewReports: false, isOpen: true, isEmpty: false, isAlreadySubmitted: finished.length > 0 }),
		launchFeedback: () => {
			savedAnswers.clear();
			return wait(0);
		},
		getFeedbackPage: (_id, page): Promise<FeedbackPage> => wait({ items: feedbackPages[page] ?? [], hasPrev: page > 0, hasNext: page < feedbackPages.length - 1 }),
		processFeedbackPage: (_id, page, responses, goPrevious) => {
			for (const r of responses) savedAnswers.set(r.name, r.value);
			if (goPrevious) return wait({ page: Math.max(0, page - 1), completed: false });
			if (page < feedbackPages.length - 1) return wait({ page: page + 1, completed: false });
			finished = finishedFromSaved();
			return wait({ page, completed: true, message: feedbacks[0].completionMessage });
		},
		getFeedbackAnalysis: () => wait(feedbackAnalysis()),
		getFeedbackFinishedResponses: () => wait(finished),

		getSurveys: (courseId) => wait(surveys.filter((s) => s.courseId === courseId).map((s) => ({ ...s }))),
		getSurveyQuestions: () => wait(surveyQuestions),
		submitSurveyAnswers: (surveyId) => {
			const s = surveys.find((x) => x.id === surveyId);
			if (s) s.done = true;
			return wait(undefined);
		},
	};
}
