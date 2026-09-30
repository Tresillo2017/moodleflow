import type { AssessmentDimension, AssessmentValues, Workshop, WorkshopAssessment, WorkshopPhase, WorkshopPlanPhase, WorkshopSubmission } from "@/types/workshop";
import type { WorkshopApi } from "./client-workshop";

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const ahead = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
const wait = <T>(value: T, ms = 200): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const ME = 1;
const DAY = 60 * 24;

// Workshop 1 is mid-assessment (peer review demo); workshop 2 is open for submissions.
const workshops: Workshop[] = [
	{
		id: 1, cmid: 41, courseId: 1, name: "Peer review: Series convergence essay", strategy: "accumulative", phase: "assessment",
		intro: "<p>Write a short essay on convergence tests, then review two classmates' essays.</p>",
		instructAuthors: "<p>Explain <strong>two</strong> convergence tests with one worked example each.</p>",
		instructReviewers: "<p>Grade each criterion and leave a comment. Be specific and kind.</p>",
		text: "optional", files: "optional", maxAttachments: 2, maxBytes: 10_485_760, lateSubmissions: false, usePeerAssessment: true, useSelfAssessment: false,
		grade: 80, gradingGrade: 20, submissionEnd: ago(2 * DAY), assessmentEnd: ahead(3 * DAY),
	},
	{
		id: 2, cmid: 42, courseId: 1, name: "Proof workshop: rubric round", strategy: "rubric", phase: "submission",
		intro: "<p>Submit a proof of the comparison test. Reviewers will use a rubric.</p>",
		text: "required", files: "optional", maxAttachments: 2, maxBytes: 10_485_760, lateSubmissions: true, usePeerAssessment: true, useSelfAssessment: false,
		grade: 80, gradingGrade: 20, submissionEnd: ahead(5 * DAY),
	},
];

interface MockSubmission extends WorkshopSubmission {
	workshopId: number;
}
let nextId = 100;
const sub = (id: number, workshopId: number, authorId: number, title: string, content: string, minutesAgo: number, extra: Partial<WorkshopSubmission> = {}): MockSubmission => ({
	id, workshopId, authorId, title, content, timeCreated: ago(minutesAgo), timeModified: ago(minutesAgo), published: false, late: false, files: [], ...extra,
});
let submissions: MockSubmission[] = [
	sub(10, 1, ME, "Ratio and root tests in practice", "<p>The <strong>ratio test</strong> compares consecutive terms; the root test looks at the n-th root.</p><p>Example: sum of n!/nⁿ converges by the ratio test.</p>", 3 * DAY, {
		files: [{ name: "essay-draft.pdf", url: "https://demo.moodleflow.dev/pluginfile.php/1/mod_workshop/submission_attachment/10/essay-draft.pdf", size: 184_320, mimeType: "application/pdf" }],
	}),
	sub(11, 1, 2, "Comparison tests explained", "<p>If 0 ≤ aₙ ≤ bₙ and Σbₙ converges then Σaₙ converges.</p><ul><li>Direct comparison</li><li>Limit comparison</li></ul>", 2.5 * DAY),
	sub(12, 1, 3, "Integral test and the p-series", "<p>The integral test shows Σ1/nᵖ converges exactly when p &gt; 1.</p>", 2.2 * DAY, {
		files: [{ name: "p-series.pdf", url: "https://demo.moodleflow.dev/pluginfile.php/1/mod_workshop/submission_attachment/12/p-series.pdf", size: 92_160, mimeType: "application/pdf" }],
	}),
];

interface MockAssessment extends WorkshopAssessment {
	workshopId: number;
	answers?: AssessmentValues;
}
let assessments: MockAssessment[] = [
	{ id: 20, workshopId: 1, submissionId: 11, reviewerId: ME, weight: 1, timeModified: ago(60) },
	{ id: 21, workshopId: 1, submissionId: 12, reviewerId: ME, weight: 1, timeModified: ago(120), grade: 80, feedbackAuthor: "<p>Clear and concise. Add a second example next time.</p>", answers: { feedback: "<p>Clear and concise. Add a second example next time.</p>", dimensions: { 0: { grade: 8, comment: "Right" }, 1: { grade: 4, comment: "One example only" }, 2: { grade: 5 } } } },
	{ id: 30, workshopId: 1, submissionId: 10, reviewerId: 2, weight: 1, timeModified: ago(90), grade: 87.5, gradingGrade: 18, feedbackAuthor: "<p>Great worked example. The root test paragraph could be longer.</p>", answers: { feedback: "<p>Great worked example. The root test paragraph could be longer.</p>", dimensions: { 0: { grade: 9, comment: "Both tests are stated correctly." }, 1: { grade: 5, comment: "Nice n!/nⁿ example." }, 2: { grade: 3, comment: "A few typos." } } } },
	{ id: 31, workshopId: 1, submissionId: 10, reviewerId: 3, weight: 1, timeModified: ago(45), grade: 72.5, gradingGrade: 16, feedbackAuthor: "<p>Good start, but the root test needs its own example.</p>", answers: { feedback: "<p>Good start, but the root test needs its own example.</p>", dimensions: { 0: { grade: 8, comment: "Correct statements." }, 1: { grade: 3, comment: "Only one example." }, 2: { grade: 4 } } } },
];

const accumulativeDimensions: AssessmentDimension[] = [
	{ index: 0, id: 1, description: "<p><strong>Correctness</strong>: are the tests stated and applied correctly?</p>", maxGrade: 10, weight: 2 },
	{ index: 1, id: 2, description: "<p><strong>Examples</strong>: is there a worked example for each test?</p>", maxGrade: 5, weight: 1 },
	{ index: 2, id: 3, description: "<p><strong>Writing</strong>: is it clear and well organised?</p>", scale: ["Poor", "Fair", "Good", "Very good", "Excellent"], weight: 1 },
];
const rubricDimensions: AssessmentDimension[] = [
	{ index: 0, id: 4, description: "<p>Rigour of the proof</p>", levels: [{ id: 41, grade: 0, definition: "Major gaps" }, { id: 42, grade: 2, definition: "Minor gaps" }, { id: 43, grade: 4, definition: "Complete" }] },
];

const workshopOf = (id: number) => workshops.find((w) => w.id === id);
const scaleMax = (d: AssessmentDimension) => d.maxGrade ?? d.scale?.length ?? 0;
/** Weighted percentage, like Moodle's accumulative strategy. */
function percent(values: AssessmentValues): number {
	const dims = accumulativeDimensions;
	const total = dims.reduce((sum, d) => sum + scaleMax(d) * (d.weight ?? 1), 0);
	const got = dims.reduce((sum, d) => sum + (values.dimensions[d.index]?.grade ?? 0) * (d.weight ?? 1), 0);
	return Math.round((got / total) * 1000) / 10;
}

function plan(phase: WorkshopPhase, mine: boolean, reviewsLeft: number): WorkshopPlanPhase[] {
	const order: [number, WorkshopPhase, string][] = [[10, "setup", "Setup phase"], [20, "submission", "Submission phase"], [30, "assessment", "Assessment phase"], [40, "evaluation", "Grading evaluation phase"], [50, "closed", "Closed"]];
	const tasks: Record<string, WorkshopPlanPhase["tasks"]> = {
		submission: [{ title: "Submit your work", status: mine ? "done" : "todo" }],
		assessment: [{ title: "Assess peers", status: reviewsLeft ? "todo" : "done", details: `${reviewsLeft} left` }],
		evaluation: [{ title: "Wait for your teacher to grade the assessments", status: "info" }],
	};
	return order.map(([code, p, title]) => ({ code, phase: p, title, active: p === phase, tasks: tasks[p] ?? [] }));
}

export function createMockWorkshopApi(): WorkshopApi {
	return {
		getWorkshops: (courseId) => wait(workshops.map((w) => ({ ...w, courseId }))),

		getWorkshopAccess: (w) =>
			wait({
				canSubmit: true,
				canAssess: true,
				canViewAllSubmissions: w.phase === "closed",
				canViewAuthorNames: true,
				canViewReviewerNames: true,
				canViewAllAssessments: false,
				canCreateSubmission: w.phase === "submission",
				canModifySubmission: w.phase === "submission",
				canAssessNow: w.phase === "assessment",
			}),

		getWorkshopPlan: (id) => {
			const phase = workshopOf(id)?.phase ?? "setup";
			const mine = submissions.some((s) => s.workshopId === id && s.authorId === ME);
			return wait(plan(phase, mine, assessments.filter((a) => a.workshopId === id && a.reviewerId === ME && a.grade === undefined).length));
		},

		getWorkshopSubmissions: (id) => {
			const closed = workshopOf(id)?.phase === "closed";
			return wait(submissions.filter((s) => s.workshopId === id && (closed || s.authorId === ME || assessments.some((a) => a.submissionId === s.id && a.reviewerId === ME))));
		},

		getWorkshopSubmission: (id) => {
			const s = submissions.find((x) => x.id === id);
			return s ? wait(s) : Promise.reject(new Error("Submission not found."));
		},

		async saveWorkshopSubmission(workshopId, input, submissionId) {
			const files = input.files.map((f) => ({ name: f.name, url: `https://demo.moodleflow.dev/pluginfile.php/1/mod_workshop/submission_attachment/${nextId}/${f.name}`, size: f.size, mimeType: f.type || undefined }));
			const existing = submissions.find((s) => s.id === submissionId);
			if (existing) {
				submissions = submissions.map((s) => (s.id === submissionId ? { ...s, title: input.title, content: input.content, files, timeModified: ago(0) } : s));
				return wait(existing.id);
			}
			const id = nextId++;
			submissions = [...submissions, sub(id, workshopId, ME, input.title, input.content, 0, { files })];
			return wait(id, 400);
		},

		deleteWorkshopSubmission: (id) => {
			submissions = submissions.filter((s) => s.id !== id);
			return wait(undefined);
		},

		getWorkshopReviews: (id) => wait(assessments.filter((a) => a.workshopId === id && a.reviewerId === ME)),

		getWorkshopAssessmentForm: (assessmentId, strategy) => {
			const a = assessments.find((x) => x.id === assessmentId);
			const dimensions = (strategy === "rubric" ? rubricDimensions : accumulativeDimensions).map((d) => ({ ...d, grade: a?.answers?.dimensions[d.index]?.grade, comment: a?.answers?.dimensions[d.index]?.comment }));
			return wait({ assessmentId, strategy, dimensions, feedback: a?.answers?.feedback ?? "", supported: true });
		},

		saveWorkshopAssessment: (form, values) => {
			assessments = assessments.map((a) => (a.id === form.assessmentId ? { ...a, answers: values, feedbackAuthor: values.feedback, grade: percent(values), timeModified: ago(0) } : a));
			return wait(undefined, 400);
		},

		getWorkshopGrades: (id) => wait(workshopOf(id)?.phase === "closed" ? { submission: 64, assessment: 18 } : {}),

		getSubmissionAssessments: (submissionId) => wait(assessments.filter((a) => a.submissionId === submissionId && a.reviewerId !== ME && a.grade !== undefined)),
	};
}
