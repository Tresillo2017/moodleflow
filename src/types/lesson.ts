/** Moodle sentinel `newpageid` for "end of lesson". */
export const LESSON_EOL = -9;

export interface LessonInfo {
	id: number;
	cmid: number;
	courseId: number;
	name: string;
	/** HTML */
	intro?: string;
	/** ISO date the lesson opens / closes, when set. */
	available?: string;
	deadline?: string;
	/** Seconds; 0 = untimed. */
	timeLimit: number;
	/** 0 = unlimited. */
	maxAttempts: number;
	retake: boolean;
	review: boolean;
	practice: boolean;
	progressBar: boolean;
	/** Running score is shown while answering. */
	ongoingScore: boolean;
	passwordRequired: boolean;
	/** Maximum grade; 0 = ungraded. */
	grade: number;
}

/** Whether the user can enter, from `mod_lesson_get_lesson_access_information` (best effort). */
export interface LessonAccess {
	canManage: boolean;
	/** Human-readable reasons the lesson can't be entered right now. */
	blocked: string[];
	attempts: number;
	firstPageId?: number;
	lastPageSeen?: number;
}

export type LessonPageKind = "content" | "multichoice" | "truefalse" | "shortanswer" | "numerical" | "matching" | "essay" | "unknown";

export interface LessonAnswer {
	id: number;
	/** HTML: the option label, or the button label on content pages. */
	text: string;
	/** Raw Moodle jump target of a content page button. */
	jumpTo: number;
}

export interface LessonMatchPair {
	id: number;
	prompt: string;
	/** Selectable responses; `value` is what Moodle expects back. */
	options: { value: string; label: string }[];
}

export interface LessonPage {
	id: number;
	title: string;
	kind: LessonPageKind;
	/** Moodle's numeric page type. */
	typeId: number;
	/** HTML body / question text. */
	contents: string;
	/** Moodle's rendered page (includes the learner's answer in review mode). */
	rendered: string;
	prevId: number;
	nextId: number;
	answers: LessonAnswer[];
	/** Multichoice with several correct answers (checkboxes). */
	multiple: boolean;
	pairs: LessonMatchPair[];
	/** Moodle's `_qf__…` hidden form markers, echoed back on submit. */
	formFields: Record<string, string>;
	ongoingScore?: string;
	/** 0-100 */
	progress?: number;
	messages: string[];
}

/** One entry of the lesson's page list (`mod_lesson_get_pages`). */
export interface LessonOutlineEntry {
	id: number;
	title: string;
	kind: LessonPageKind;
	prevId: number;
	nextId: number;
}

/** What the learner did on the current page. */
export interface LessonInput {
	/** Content page button (its answer's raw jump target). */
	jumpTo?: number;
	/** Single choice / true-false answer id. */
	choice?: number;
	/** Multiple-choice answer ids. */
	choices?: number[];
	/** Short answer / numerical / essay text. */
	text?: string;
	/** Matching: pair id -> chosen option value. */
	matches?: Record<number, string>;
}

export interface LessonPageResult {
	/** Actual page id to show next, `LESSON_EOL` for the end, or 0/same id to retry. */
	newPageId: number;
	/** HTML feedback shown between pages, when the lesson has any. */
	feedback?: string;
	response?: string;
	correct: boolean;
	noAnswer: boolean;
	essay: boolean;
	attemptsRemaining: number;
	maxAttemptsReached: boolean;
	ongoingScore?: string;
	progress?: number;
	messages: string[];
}

export interface LessonFinish {
	/** HTML lines from Moodle ("Congratulations", grade line, …). */
	messages: string[];
	results: { label: string; value: string }[];
}

export interface LessonGrade {
	grade: number | null;
	formatted?: string;
}

export interface LessonOptions {
	password?: string;
	review?: boolean;
}
