import { callMoodle, type MoodleParams } from "./call";
import {
	normalizeChoiceOptions,
	normalizeChoiceResults,
	normalizeChoices,
	normalizeFeedbackAccess,
	normalizeFeedbackAnalysis,
	normalizeFeedbackPage,
	normalizeFeedbackProcess,
	normalizeFeedbacks,
	normalizeFinishedResponses,
	normalizeSurveyQuestions,
	normalizeSurveys,
} from "./normalize-engage";
import { asRecord } from "./normalize";
import type { SocialContext } from "./client-social";
import type {
	Choice,
	ChoiceOption,
	ChoiceResult,
	Feedback,
	FeedbackAccess,
	FeedbackAnalysis,
	FeedbackPage,
	FeedbackProcessResult,
	FeedbackResponse,
	FeedbackResponseValue,
	Survey,
	SurveyQuestion,
} from "@/types/engage";

/** Choice, feedback and survey activities (Phase 4). */
export interface EngageApi {
	getChoices(courseId: number): Promise<Choice[]>;
	getChoiceOptions(choiceId: number): Promise<ChoiceOption[]>;
	/** Throws when the choice doesn't publish results to this user yet. */
	getChoiceResults(choiceId: number): Promise<ChoiceResult[]>;
	/** Replaces the user's vote with these option ids. */
	submitChoice(choiceId: number, optionIds: number[]): Promise<void>;
	/** Withdraws all of the user's responses. */
	deleteChoiceResponses(choiceId: number): Promise<void>;

	getFeedbacks(courseId: number): Promise<Feedback[]>;
	getFeedbackAccess(feedbackId: number): Promise<FeedbackAccess>;
	/** Starts or resumes an attempt; resolves to the page to show (0-based). */
	launchFeedback(feedbackId: number, courseId: number): Promise<number>;
	getFeedbackPage(feedbackId: number, page: number): Promise<FeedbackPage>;
	processFeedbackPage(feedbackId: number, page: number, responses: FeedbackResponse[], goPrevious: boolean): Promise<FeedbackProcessResult>;
	getFeedbackAnalysis(feedbackId: number): Promise<FeedbackAnalysis>;
	/** The user's last finished attempt. */
	getFeedbackFinishedResponses(feedbackId: number): Promise<FeedbackResponseValue[]>;

	getSurveys(courseId: number): Promise<Survey[]>;
	getSurveyQuestions(surveyId: number): Promise<SurveyQuestion[]>;
	submitSurveyAnswers(surveyId: number, answers: { key: string; value: string }[]): Promise<void>;
}

const list = (values: number[]): MoodleParams => Object.fromEntries(values.map((v, i) => [i, v]));

export function createEngageApi({ connection }: SocialContext): EngageApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");

	return {
		async getChoices(courseId) {
			return normalizeChoices(await get("mod_choice_get_choices_by_courses", { courseids: list([courseId]) }));
		},
		async getChoiceOptions(choiceId) {
			return normalizeChoiceOptions(await get("mod_choice_get_choice_options", { choiceid: choiceId }));
		},
		async getChoiceResults(choiceId) {
			return normalizeChoiceResults(await get("mod_choice_get_choice_results", { choiceid: choiceId }));
		},
		async submitChoice(choiceId, optionIds) {
			await post("mod_choice_submit_choice_response", { choiceid: choiceId, responses: list(optionIds) });
		},
		async deleteChoiceResponses(choiceId) {
			await post("mod_choice_delete_choice_responses", { choiceid: choiceId });
		},

		async getFeedbacks(courseId) {
			return normalizeFeedbacks(await get("mod_feedback_get_feedbacks_by_courses", { courseids: list([courseId]) }));
		},
		async getFeedbackAccess(feedbackId) {
			return normalizeFeedbackAccess(await get("mod_feedback_get_feedback_access_information", { feedbackid: feedbackId }));
		},
		async launchFeedback(feedbackId, courseId) {
			const gopage = Number(asRecord(await post("mod_feedback_launch_feedback", { feedbackid: feedbackId, courseid: courseId })).gopage);
			return gopage > 0 ? gopage : 0;
		},
		async getFeedbackPage(feedbackId, page) {
			return normalizeFeedbackPage(await get("mod_feedback_get_page_items", { feedbackid: feedbackId, page }));
		},
		async processFeedbackPage(feedbackId, page, responses, goPrevious) {
			const raw = await post("mod_feedback_process_page", {
				feedbackid: feedbackId,
				page,
				responses: Object.fromEntries(responses.map((r, i) => [i, { name: r.name, value: r.value }])),
				goprevious: goPrevious ? 1 : 0,
			});
			return normalizeFeedbackProcess(raw, page);
		},
		async getFeedbackAnalysis(feedbackId) {
			return normalizeFeedbackAnalysis(await get("mod_feedback_get_analysis", { feedbackid: feedbackId }));
		},
		async getFeedbackFinishedResponses(feedbackId) {
			return normalizeFinishedResponses(await get("mod_feedback_get_finished_responses", { feedbackid: feedbackId }));
		},

		async getSurveys(courseId) {
			return normalizeSurveys(await get("mod_survey_get_surveys_by_courses", { courseids: list([courseId]) }));
		},
		async getSurveyQuestions(surveyId) {
			return normalizeSurveyQuestions(await get("mod_survey_get_questions", { surveyid: surveyId }));
		},
		async submitSurveyAnswers(surveyId, answers) {
			await post("mod_survey_submit_answers", {
				surveyid: surveyId,
				answers: Object.fromEntries(answers.map((a, i) => [i, { key: a.key, value: a.value }])),
			});
		},
	};
}
