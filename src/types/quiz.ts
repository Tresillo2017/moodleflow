/** Quiz domain types (Phase 4). Raw Moodle field names stay inside normalize-quiz*.ts. */

export type QuizGradeMethod = "highest" | "average" | "first" | "last";

export interface Quiz {
	id: number;
	cmid: number;
	courseId: number;
	name: string;
	intro?: string;
	timeOpen?: string;
	timeClose?: string;
	/** Seconds; undefined when untimed. */
	timeLimit?: number;
	/** 0 = unlimited. */
	maxAttempts: number;
	gradeMethod: QuizGradeMethod;
	maxGrade: number;
	/** Total marks; an attempt's grade is sumGrades / this * maxGrade. */
	sumGrades: number;
	navMethod: "free" | "sequential";
	questionsPerPage: number;
	decimalPoints: number;
	hasQuestions: boolean;
}

export interface QuizAccess {
	canAttempt: boolean;
	canPreview: boolean;
	/** Rule descriptions ("Time limit: 30 mins", ...). */
	rules: string[];
	/** Why the user can't open the quiz at all right now (empty when they can). */
	blockedReasons: string[];
	/** Why a new attempt can't be started (attempts used up, waiting period, ...). */
	newAttemptBlockedReasons: string[];
	/** The quiz asks for a password before an attempt starts. */
	requiresPassword: boolean;
}

export type QuizAttemptState = "inprogress" | "overdue" | "finished" | "abandoned";

export interface QuizAttempt {
	id: number;
	quizId: number;
	/** 1-based attempt number. */
	number: number;
	/** Question usage id; needed to flag questions. */
	uniqueId: number;
	state: QuizAttemptState;
	timeStart: string;
	timeFinish?: string;
	sumGrades?: number;
	currentPage: number;
	preview: boolean;
}

export interface QuizBestGrade {
	hasGrade: boolean;
	grade?: number;
}

export interface QuizAttemptAccess {
	/** When the attempt must be submitted by; undefined for untimed attempts. */
	endTime?: string;
	isFinished: boolean;
}

/** mod_quiz_get_combined_review_options: what students may see once attempts finish. */
export interface QuizReviewOptions {
	attempt: boolean;
	correctness: boolean;
	marks: boolean;
	specificFeedback: boolean;
	generalFeedback: boolean;
	rightAnswer: boolean;
	overallFeedback: boolean;
}

export type QuizCorrectness = "correct" | "partial" | "incorrect";

export type QuizQuestionState = "todo" | "complete" | "correct" | "partial" | "incorrect" | "gaveup" | "needsgrading" | "other";

export interface QuizFeedbackBlock {
	kind: "specific" | "general" | "rightanswer" | "teacher";
	html: string;
}

export interface QuizChoiceOption {
	value: string;
	/** Answer text HTML without its "a." / "b." prefix or input. */
	html: string;
	feedbackHtml?: string;
	correctness?: QuizCorrectness;
}

export interface QuizMatchRow {
	/** Form field carrying the chosen option. */
	field: string;
	stemHtml: string;
	options: { value: string; label: string }[];
	correctness?: QuizCorrectness;
}

export type QuizQuestionBody =
	| { kind: "choice"; multiple: boolean; prompt?: string; /** Radio field name (single) */ field: string; options: (QuizChoiceOption & { field: string })[] }
	| {
			kind: "text";
			field: string;
			numeric: boolean;
			correctness?: QuizCorrectness;
			unit?: { field: string; options?: { value: string; label: string }[] };
	  }
	| { kind: "match"; prompt?: string; rows: QuizMatchRow[] }
	| {
			kind: "essay";
			/** Absent when the response is only displayed (review). */
			field?: string;
			formatField?: string;
			/** Moodle text format of the response: 1 = HTML. */
			format: number;
			/** The submitted response as displayed by Moodle (review). */
			responseHtml?: string;
			hasAttachments: boolean;
	  }
	| { kind: "description" }
	| { kind: "unsupported" };

/** Everything core_question_update_flag needs, lifted from the rendered question. */
export interface QuizFlagTarget {
	qubaId: number;
	qaId: number;
	questionId: number;
	slot: number;
	checksum: string;
}

export interface QuizQuestion {
	slot: number;
	page: number;
	qtype: string;
	/** "1", "2", ... (empty for descriptions). */
	number?: string;
	stateLabel: string;
	state: QuizQuestionState;
	flagged: boolean;
	maxMark?: string;
	mark?: string;
	/** Question text HTML (the stem). */
	textHtml: string;
	/** Rendered question HTML, for the read-only fallback. */
	html: string;
	body: QuizQuestionBody;
	/** Input names -> values as rendered, i.e. what a save must post back (includes the sequence check). */
	fields: Record<string, string>;
	feedback: QuizFeedbackBlock[];
	flag?: QuizFlagTarget;
	/** Rendered with inputs disabled (review, or a finished attempt). */
	readOnly: boolean;
}

export interface QuizAttemptPage {
	attempt: QuizAttempt;
	questions: QuizQuestion[];
	/** -1 on the last page. */
	nextPage: number;
	messages: string[];
}

/** One row of the attempt summary / navigation panel. */
export interface QuizNavItem {
	slot: number;
	page: number;
	number: string;
	state: QuizQuestionState;
	statusLabel: string;
	flagged: boolean;
	/** Whether the question is a real question (descriptions aren't numbered). */
	answerable: boolean;
}

export interface QuizAttemptReview {
	attempt: QuizAttempt;
	/** Formatted grade out of the quiz's max grade; undefined when hidden. */
	grade?: string;
	summary: { label: string; value: string }[];
	questions: QuizQuestion[];
}
