import type { MoodleFile } from "@/types/moodle";

export type WorkshopPhase = "setup" | "submission" | "assessment" | "evaluation" | "closed";

/** Grading strategies we can render a form for; anything else falls back to Moodle. */
export const SUPPORTED_STRATEGIES = ["accumulative", "numerrors", "comments", "rubric"] as const;

/** Whether a submission part is switched off, allowed, or required. */
export type SubmissionPart = "off" | "optional" | "required";

export interface Workshop {
	id: number;
	cmid: number;
	courseId: number;
	name: string;
	intro?: string;
	instructAuthors?: string;
	instructReviewers?: string;
	conclusion?: string;
	strategy: string;
	phase: WorkshopPhase;
	text: SubmissionPart;
	files: SubmissionPart;
	maxAttachments: number;
	maxBytes?: number;
	lateSubmissions: boolean;
	usePeerAssessment: boolean;
	useSelfAssessment: boolean;
	/** Points the submission grade is out of. */
	grade: number;
	/** Points the assessment grade is out of. */
	gradingGrade: number;
	submissionEnd?: string;
	assessmentEnd?: string;
}

export interface WorkshopAccess {
	canSubmit: boolean;
	canAssess: boolean;
	canViewAllSubmissions: boolean;
	canViewAuthorNames: boolean;
	canViewReviewerNames: boolean;
	canViewAllAssessments: boolean;
	canCreateSubmission: boolean;
	canModifySubmission: boolean;
	canAssessNow: boolean;
}

export type PlanTaskStatus = "done" | "todo" | "info" | "fail";

export interface WorkshopPlanTask {
	title: string;
	status: PlanTaskStatus;
	details?: string;
	link?: string;
}

export interface WorkshopPlanPhase {
	code: number;
	phase: WorkshopPhase;
	title: string;
	active: boolean;
	tasks: WorkshopPlanTask[];
}

export interface WorkshopSubmission {
	id: number;
	authorId: number;
	title: string;
	/** Moodle HTML. */
	content: string;
	timeCreated: string;
	timeModified: string;
	/** Grade for the submission (out of Workshop.grade); undefined until graded. */
	grade?: number;
	gradeOverride?: number;
	feedback?: string;
	published: boolean;
	late: boolean;
	files: MoodleFile[];
}

export interface WorkshopSubmissionInput {
	title: string;
	content: string;
	/** Everything the submission should end up with: kept files must be re-read into Files by the caller. */
	files: File[];
}

export interface WorkshopAssessment {
	id: number;
	submissionId: number;
	reviewerId: number;
	weight: number;
	timeModified: string;
	/** Percentage-like grade the reviewer gave (out of 100); undefined until assessed. */
	grade?: number;
	/** How the assessment itself was graded (out of 100). */
	gradingGrade?: number;
	feedbackAuthor?: string;
	feedbackReviewer?: string;
}

export interface AssessmentLevel {
	id: number;
	grade: number;
	definition: string;
}

/** One criterion of an assessment form; which fields matter depends on the strategy. */
export interface AssessmentDimension {
	/** Position in the form (the `__idx_N` suffix Moodle expects back). */
	index: number;
	id: number;
	description: string;
	/** Accumulative: highest grade (points). */
	maxGrade?: number;
	/** Accumulative with a scale: the options, lowest first (grade = position + 1). */
	scale?: string[];
	weight?: number;
	/** Numerrors: labels for grade 0 and 1. */
	labels?: [string, string];
	/** Rubric levels. */
	levels?: AssessmentLevel[];
	/** Current answers. */
	grade?: number;
	chosenLevel?: number;
	comment?: string;
}

export interface AssessmentForm {
	assessmentId: number;
	strategy: string;
	dimensions: AssessmentDimension[];
	/** Overall feedback for the author (Moodle HTML). */
	feedback: string;
	/** False when Moodle sent a form shape we can't render. */
	supported: boolean;
}

/** Answers to an AssessmentForm, keyed by dimension index. */
export interface AssessmentValues {
	feedback: string;
	dimensions: Record<number, { grade?: number; chosenLevel?: number; comment?: string }>;
}

export interface WorkshopGrades {
	/** Final submission grade (out of Workshop.grade). */
	submission?: number;
	/** Final assessment grade (out of Workshop.gradingGrade). */
	assessment?: number;
}
