// Choice, feedback and survey activities (Phase 4).

// ---- choice ----

/** Choice `showresults`: when students may see the results. */
export const CHOICE_SHOW = { never: 0, afterAnswer: 1, afterClose: 2, always: 3 } as const;

export interface Choice {
	id: number;
	cmid: number;
	courseId: number;
	name: string;
	intro?: string;
	/** Results list voters by name (else counts only). */
	publishNames: boolean;
	showResults: number;
	allowUpdate: boolean;
	allowMultiple: boolean;
	timeOpen?: string;
	timeClose?: string;
}

export interface ChoiceOption {
	id: number;
	text: string;
	/** 0 = unlimited. */
	maxAnswers: number;
	count: number;
	checked: boolean;
	disabled: boolean;
}

export interface ChoiceVoter {
	userId: number;
	fullName: string;
	imageUrl?: string;
}

export interface ChoiceResult {
	id: number;
	text: string;
	votes: number;
	percent: number;
	voters: ChoiceVoter[];
}

// ---- feedback ----

export interface Feedback {
	id: number;
	cmid: number;
	courseId: number;
	name: string;
	intro?: string;
	anonymous: boolean;
	multipleSubmit: boolean;
	publishStats: boolean;
	/** HTML shown after submitting. */
	completionMessage?: string;
	afterSubmitUrl?: string;
	timeOpen?: string;
	timeClose?: string;
}

export interface FeedbackAccess {
	canComplete: boolean;
	canSubmit: boolean;
	canViewAnalysis: boolean;
	canViewReports: boolean;
	isOpen: boolean;
	isEmpty: boolean;
	isAlreadySubmitted: boolean;
}

export type FeedbackItemType = "label" | "textfield" | "textarea" | "multichoice" | "numeric" | "info" | "captcha" | "unsupported";

export interface FeedbackChoice {
	/** 1-based, what Moodle stores and expects back. */
	value: number;
	label: string;
}

export interface FeedbackItem {
	id: number;
	type: FeedbackItemType;
	/** Moodle's own `typ`, for the unsupported fallback. */
	rawType: string;
	name: string;
	required: boolean;
	/** Label items: the HTML body. */
	html?: string;
	/** Textfield. */
	maxLength?: number;
	/** Numeric bounds. */
	min?: number;
	max?: number;
	/** Multichoice (and rated). */
	style?: "radio" | "check" | "dropdown";
	choices?: FeedbackChoice[];
	hideNoSelect?: boolean;
	/** Info: 1 = date, 2 = course, 3 = category. */
	infoKind?: number;
	dependItem: number;
	dependValue: string;
}

export interface FeedbackPage {
	items: FeedbackItem[];
	hasPrev: boolean;
	hasNext: boolean;
}

/** Form state per item id: text, a selected choice value, or the selected values of a checkbox group. */
export type FeedbackAnswers = Record<number, string | string[]>;

export interface FeedbackResponse {
	name: string;
	value: string;
}

export interface FeedbackProcessResult {
	/** Page to show next (unchanged when nothing was accepted). */
	page: number;
	completed: boolean;
	message?: string;
	redirectUrl?: string;
}

export interface FeedbackAnalysisItem {
	id: number;
	name: string;
	type: string;
	choices: { label: string; count: number; percent: number }[];
	texts: string[];
	stats: { label: string; value: string }[];
}

export interface FeedbackAnalysis {
	completedCount: number;
	items: FeedbackAnalysisItem[];
}

export interface FeedbackResponseValue {
	id: number;
	name: string;
	value: string;
}

// ---- survey ----

export interface Survey {
	id: number;
	cmid: number;
	courseId: number;
	name: string;
	intro?: string;
	done: boolean;
}

export interface SurveyQuestion {
	id: number;
	text: string;
	/** Group heading (no answer of its own), free text, or a scale. */
	kind: "header" | "text" | "scale";
	intro?: string;
	options: string[];
	/** Scale questions: answer the "actual" and/or "preferred" scale. */
	actual: boolean;
	preferred: boolean;
	isSub: boolean;
}

/** Keyed `q<id>` (actual/text) or `qP<id>` (preferred). */
export type SurveyAnswers = Record<string, string>;
