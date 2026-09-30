import type {
	Quiz,
	QuizAccess,
	QuizAttempt,
	QuizAttemptAccess,
	QuizAttemptPage,
	QuizAttemptReview,
	QuizAttemptState,
	QuizBestGrade,
	QuizGradeMethod,
	QuizNavItem,
	QuizQuestion,
	QuizReviewOptions,
} from "@/types/quiz";
import { asArray, asRecord } from "./normalize";
import { mapQuestionState, normalizeQuizQuestion } from "./normalize-quiz-question";

const GRADE_METHODS: Record<number, QuizGradeMethod> = { 1: "highest", 2: "average", 3: "first", 4: "last" };

const seconds = (v: unknown) => (Number(v) > 0 ? new Date(Number(v) * 1000).toISOString() : undefined);
const strings = (v: unknown) => asArray(v).map(String).filter(Boolean);
const stripTags = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// mod_quiz_get_quizzes_by_courses
export function normalizeQuizzes(raw: unknown): Quiz[] {
	return asArray(asRecord(raw).quizzes).map((q) => {
		const r = asRecord(q);
		return {
			id: Number(r.id),
			cmid: Number(r.coursemodule ?? 0),
			courseId: Number(r.course ?? 0),
			name: String(r.name ?? ""),
			intro: r.intro ? String(r.intro) : undefined,
			timeOpen: seconds(r.timeopen),
			timeClose: seconds(r.timeclose),
			timeLimit: Number(r.timelimit) > 0 ? Number(r.timelimit) : undefined,
			maxAttempts: Number(r.attempts ?? 0),
			gradeMethod: GRADE_METHODS[Number(r.grademethod)] ?? "highest",
			maxGrade: Number(r.grade ?? 0),
			sumGrades: Number(r.sumgrades ?? 0),
			navMethod: r.navmethod === "sequential" ? "sequential" : "free",
			questionsPerPage: Number(r.questionsperpage ?? 0),
			decimalPoints: Number(r.decimalpoints) >= 0 ? Number(r.decimalpoints) : 2,
			hasQuestions: r.hasquestions === undefined ? true : Boolean(r.hasquestions),
		};
	});
}

// mod_quiz_get_quiz_access_information + mod_quiz_get_attempt_access_information (attempt 0)
export function normalizeQuizAccess(info: unknown, attemptAccess: unknown): QuizAccess {
	const i = asRecord(info);
	const a = attemptAccess && typeof attemptAccess === "object" ? (attemptAccess as Record<string, unknown>) : {};
	return {
		canAttempt: Boolean(i.canattempt),
		canPreview: Boolean(i.canpreview),
		rules: strings(i.accessrules),
		blockedReasons: strings(i.preventaccessreasons),
		newAttemptBlockedReasons: strings(a.preventnewattemptreasons),
		requiresPassword: strings(i.activerulenames).includes("quizaccess_password"),
	};
}

const ATTEMPT_STATES = new Set<QuizAttemptState>(["inprogress", "overdue", "finished", "abandoned"]);

export function normalizeQuizAttempt(raw: unknown): QuizAttempt {
	const r = asRecord(raw);
	const declared = String(r.state) as QuizAttemptState;
	return {
		id: Number(r.id),
		quizId: Number(r.quiz ?? 0),
		number: Number(r.attempt ?? 0),
		uniqueId: Number(r.uniqueid ?? 0),
		state: ATTEMPT_STATES.has(declared) ? declared : Number(r.timefinish) > 0 ? "finished" : "inprogress",
		timeStart: seconds(r.timestart) ?? new Date(0).toISOString(),
		timeFinish: seconds(r.timefinish),
		sumGrades: r.sumgrades === null || r.sumgrades === undefined ? undefined : Number(r.sumgrades),
		currentPage: Number(r.currentpage ?? 0),
		preview: Boolean(r.preview),
	};
}

// mod_quiz_get_user_attempts (oldest first) and mod_quiz_start_attempt (`attempt`)
export const normalizeQuizAttempts = (raw: unknown): QuizAttempt[] =>
	asArray(asRecord(raw).attempts)
		.map(normalizeQuizAttempt)
		.sort((a, b) => a.number - b.number);

export const normalizeStartedAttempt = (raw: unknown): QuizAttempt => normalizeQuizAttempt(asRecord(raw).attempt);

// mod_quiz_get_user_best_grade
export function normalizeQuizBestGrade(raw: unknown): QuizBestGrade {
	const r = asRecord(raw);
	const grade = r.grade === null || r.grade === undefined || r.grade === "" ? undefined : Number(r.grade);
	return { hasGrade: Boolean(r.hasgrade) && grade !== undefined && !Number.isNaN(grade), grade };
}

// mod_quiz_get_attempt_access_information
export function normalizeQuizAttemptAccess(raw: unknown): QuizAttemptAccess {
	const r = asRecord(raw);
	return { endTime: seconds(r.endtime), isFinished: Boolean(r.isfinished) };
}

// mod_quiz_get_combined_review_options: `someoptions` is what at least one attempt allows
export function normalizeQuizReviewOptions(raw: unknown): QuizReviewOptions {
	const flags = new Map(asArray(asRecord(raw).someoptions).map((o) => [String(asRecord(o).name), Number(asRecord(o).value) > 0]));
	const on = (name: string) => flags.get(name) ?? false;
	return {
		attempt: on("attempt"),
		correctness: on("correctness"),
		marks: on("marks"),
		specificFeedback: on("specificfeedback"),
		generalFeedback: on("generalfeedback"),
		rightAnswer: on("rightanswer"),
		overallFeedback: on("overallfeedback"),
	};
}

// mod_quiz_get_attempt_data
export function normalizeQuizAttemptPage(raw: unknown): QuizAttemptPage {
	const r = asRecord(raw);
	const attempt = normalizeQuizAttempt(r.attempt);
	return {
		attempt,
		questions: asArray(r.questions).map((q) => normalizeQuizQuestion(q, { qubaId: attempt.uniqueId })),
		nextPage: Number(r.nextpage ?? -1),
		messages: strings(r.messages),
	};
}

// mod_quiz_get_attempt_summary
export function normalizeQuizSummary(raw: unknown): QuizNavItem[] {
	return asArray(asRecord(raw).questions).map((q) => {
		const r = asRecord(q);
		const number = r.number === undefined || r.number === null ? "" : String(r.number);
		return {
			slot: Number(r.slot),
			page: Number(r.page ?? 0),
			number,
			state: mapQuestionState(r.state),
			statusLabel: String(r.status ?? ""),
			flagged: Boolean(r.flagged),
			answerable: r.type !== "description" && number !== "",
		};
	});
}

// mod_quiz_get_attempt_review
export function normalizeQuizAttemptReview(raw: unknown): QuizAttemptReview {
	const r = asRecord(raw);
	const attempt = normalizeQuizAttempt(r.attempt);
	const grade = typeof r.grade === "string" || typeof r.grade === "number" ? String(r.grade) : undefined;
	return {
		attempt,
		grade: grade || undefined,
		summary: asArray(r.additionaldata)
			.map((d) => ({ label: String(asRecord(d).title ?? ""), value: stripTags(String(asRecord(d).content ?? "")) }))
			.filter((d) => d.label && d.value),
		questions: asArray(r.questions).map((q) => normalizeQuizQuestion(q, { review: true, qubaId: attempt.uniqueId })),
	};
}

/** Form data to post for an attempt page: the fields of the questions on it, with the user's edits applied. */
export const quizAnswerData = (questions: QuizQuestion[], edits: Record<string, string>): Record<string, string> =>
	Object.assign({}, ...questions.map((q) => q.fields), edits);

const plainText = (html: string) => stripTags(html);

/** Whether the values (rendered fields + edits) hold an answer for the question; drives the navigation panel. */
export function isQuestionAnswered(q: QuizQuestion, values: Record<string, string>): boolean {
	const b = q.body;
	switch (b.kind) {
		case "choice":
			return b.multiple ? b.options.some((o) => values[o.field] === "1") : Boolean(values[b.field]) && values[b.field] !== "-1";
		case "text":
			return Boolean(values[b.field]?.trim());
		case "match":
			return b.rows.some((r) => values[r.field] && values[r.field] !== "0");
		case "essay":
			return Boolean(b.field && plainText(values[b.field] ?? ""));
		default:
			return false;
	}
}
