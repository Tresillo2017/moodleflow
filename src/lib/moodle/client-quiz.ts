import { callMoodle, type MoodleParams } from "./call";
import {
	normalizeQuizAccess,
	normalizeQuizAttemptAccess,
	normalizeQuizAttemptPage,
	normalizeQuizAttemptReview,
	normalizeQuizAttempts,
	normalizeQuizBestGrade,
	normalizeQuizReviewOptions,
	normalizeQuizSummary,
	normalizeQuizzes,
	normalizeStartedAttempt,
} from "./normalize-quiz";
import { asArray, asRecord } from "./normalize";
import type { SocialContext } from "./client-social";
import type {
	Quiz,
	QuizAccess,
	QuizAttempt,
	QuizAttemptAccess,
	QuizAttemptPage,
	QuizAttemptReview,
	QuizAttemptState,
	QuizBestGrade,
	QuizFlagTarget,
	QuizNavItem,
	QuizReviewOptions,
} from "@/types/quiz";

/** Quiz activities (Phase 4). */
export interface QuizApi {
	getQuiz(courseId: number, quizId: number): Promise<Quiz | undefined>;
	/** Rules and why the user can't attempt right now. */
	getQuizAccess(quizId: number): Promise<QuizAccess>;
	/** The user's own attempts, oldest first (previews excluded). */
	getQuizAttempts(quizId: number): Promise<QuizAttempt[]>;
	getQuizBestGrade(quizId: number): Promise<QuizBestGrade>;
	/** Feedback text Moodle attaches to a grade band; empty when there is none. */
	getQuizFeedback(quizId: number, grade: number): Promise<string>;
	/** Question types the quiz uses (Moodle plugin names). Empty when the site can't say. */
	getQuizRequiredQtypes(quizId: number): Promise<string[]>;
	getQuizReviewOptions(quizId: number): Promise<QuizReviewOptions>;
	startQuizAttempt(quizId: number, password?: string): Promise<QuizAttempt>;
	getQuizAttemptAccess(quizId: number, attemptId: number): Promise<QuizAttemptAccess>;
	getQuizAttemptPage(attemptId: number, page: number): Promise<QuizAttemptPage>;
	getQuizAttemptSummary(attemptId: number): Promise<QuizNavItem[]>;
	/** Autosave: stores answers without submitting or advancing. */
	saveQuizAttempt(attemptId: number, data: Record<string, string>): Promise<void>;
	/** Saves the page's answers; with `finish` submits the attempt for grading. */
	processQuizAttempt(attemptId: number, data: Record<string, string>, opts?: { finish?: boolean; timeUp?: boolean }): Promise<QuizAttemptState>;
	setQuizQuestionFlag(target: QuizFlagTarget, flagged: boolean): Promise<void>;
	getQuizAttemptReview(attemptId: number): Promise<QuizAttemptReview>;
	/** Tells Moodle the review was opened. Best effort. */
	logQuizAttemptReview(attemptId: number): Promise<void>;
}

/** Moodle's `[{name, value}]` structure for form data. */
const formData = (data: Record<string, string>): MoodleParams =>
	Object.fromEntries(Object.entries(data).map(([name, value], i) => [i, { name, value }]));

export function createQuizApi({ connection }: SocialContext): QuizApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");

	return {
		async getQuiz(courseId, quizId) {
			return normalizeQuizzes(await get("mod_quiz_get_quizzes_by_courses", { courseids: { 0: courseId } })).find((q) => q.id === quizId);
		},

		async getQuizAccess(quizId) {
			const [info, attemptAccess] = await Promise.all([
				get("mod_quiz_get_quiz_access_information", { quizid: quizId }),
				// attempt 0 = "a new attempt"; some sites reject it, and the quiz-level answer still stands
				get("mod_quiz_get_attempt_access_information", { quizid: quizId, attemptid: 0 }).catch(() => null),
			]);
			return normalizeQuizAccess(info, attemptAccess);
		},

		async getQuizAttempts(quizId) {
			return normalizeQuizAttempts(await get("mod_quiz_get_user_attempts", { quizid: quizId, status: "all", includepreviews: 0 }));
		},

		async getQuizBestGrade(quizId) {
			return normalizeQuizBestGrade(await get("mod_quiz_get_user_best_grade", { quizid: quizId }));
		},

		async getQuizFeedback(quizId, grade) {
			const text = asRecord(await get("mod_quiz_get_quiz_feedback_for_grade", { quizid: quizId, grade })).feedbacktext;
			return typeof text === "string" ? text : "";
		},

		async getQuizRequiredQtypes(quizId) {
			try {
				return asArray(asRecord(await get("mod_quiz_get_quiz_required_qtypes", { quizid: quizId })).questiontypes).map(String);
			} catch {
				return [];
			}
		},

		async getQuizReviewOptions(quizId) {
			return normalizeQuizReviewOptions(await get("mod_quiz_get_combined_review_options", { quizid: quizId }));
		},

		async startQuizAttempt(quizId, password) {
			const raw = await post("mod_quiz_start_attempt", {
				quizid: quizId,
				forcenew: 0,
				...(password ? { preflightdata: formData({ quizpassword: password }) } : {}),
			});
			return normalizeStartedAttempt(raw);
		},

		async getQuizAttemptAccess(quizId, attemptId) {
			return normalizeQuizAttemptAccess(await get("mod_quiz_get_attempt_access_information", { quizid: quizId, attemptid: attemptId }));
		},

		async getQuizAttemptPage(attemptId, page) {
			return normalizeQuizAttemptPage(await post("mod_quiz_get_attempt_data", { attemptid: attemptId, page }));
		},

		async getQuizAttemptSummary(attemptId) {
			return normalizeQuizSummary(await post("mod_quiz_get_attempt_summary", { attemptid: attemptId }));
		},

		async saveQuizAttempt(attemptId, data) {
			await post("mod_quiz_save_attempt", { attemptid: attemptId, data: formData(data) });
		},

		async processQuizAttempt(attemptId, data, opts = {}) {
			const raw = await post("mod_quiz_process_attempt", {
				attemptid: attemptId,
				data: formData(data),
				finishattempt: opts.finish ? 1 : 0,
				timeup: opts.timeUp ? 1 : 0,
			});
			const state = String(asRecord(raw).state);
			return state === "finished" || state === "overdue" || state === "abandoned" ? state : "inprogress";
		},

		async setQuizQuestionFlag(target, flagged) {
			await post("core_question_update_flag", {
				qubaid: target.qubaId,
				questionid: target.questionId,
				qaid: target.qaId,
				slot: target.slot,
				checksum: target.checksum,
				newstate: flagged ? 1 : 0,
			});
		},

		async getQuizAttemptReview(attemptId) {
			return normalizeQuizAttemptReview(await get("mod_quiz_get_attempt_review", { attemptid: attemptId, page: -1 }));
		},

		async logQuizAttemptReview(attemptId) {
			await post("mod_quiz_view_attempt_review", { attemptid: attemptId }).catch(() => {});
		},
	};
}
