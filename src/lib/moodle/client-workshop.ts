import { MoodleError } from "@/types/moodle";
import type {
	AssessmentForm,
	AssessmentValues,
	Workshop,
	WorkshopAccess,
	WorkshopAssessment,
	WorkshopGrades,
	WorkshopPlanPhase,
	WorkshopSubmission,
	WorkshopSubmissionInput,
} from "@/types/workshop";
import { callMoodle, type MoodleParams } from "./call";
import type { SocialContext } from "./client-social";
import { asRecord } from "./normalize";
import {
	assessmentData,
	normalizeAssessmentForm,
	normalizeWorkshopAccess,
	normalizeWorkshopAssessments,
	normalizeWorkshopGrades,
	normalizeWorkshopPlan,
	normalizeWorkshops,
	normalizeWorkshopSubmissionDetail,
	normalizeWorkshopSubmissions,
} from "./normalize-workshop";

/** How an assessment form is opened: to fill in, or read-only (preview shows the reviewer's answers). */
export type AssessmentMode = "assessment" | "preview";

/** Workshop activities (Phase 4). */
export interface WorkshopApi {
	getWorkshops(courseId: number): Promise<Workshop[]>;
	getWorkshopAccess(workshop: Pick<Workshop, "id" | "phase">): Promise<WorkshopAccess>;
	getWorkshopPlan(workshopId: number): Promise<WorkshopPlanPhase[]>;
	/** Every submission the user may see (their own plus, depending on phase and role, others'). */
	getWorkshopSubmissions(workshopId: number): Promise<WorkshopSubmission[]>;
	getWorkshopSubmission(submissionId: number): Promise<WorkshopSubmission>;
	/** Creates (no submissionId) or updates the user's submission; returns its id. */
	saveWorkshopSubmission(workshopId: number, input: WorkshopSubmissionInput, submissionId?: number): Promise<number>;
	deleteWorkshopSubmission(submissionId: number): Promise<void>;
	/** Assessments the user has to do (or did), with the submission each is about. */
	getWorkshopReviews(workshopId: number): Promise<WorkshopAssessment[]>;
	getWorkshopAssessmentForm(assessmentId: number, strategy: string, mode?: AssessmentMode): Promise<AssessmentForm>;
	saveWorkshopAssessment(form: AssessmentForm, values: AssessmentValues): Promise<void>;
	getWorkshopGrades(workshopId: number): Promise<WorkshopGrades>;
	/** Assessments others wrote about one submission. */
	getSubmissionAssessments(submissionId: number): Promise<WorkshopAssessment[]>;
}

export function createWorkshopApi({ connection, userId, uploadFiles }: SocialContext): WorkshopApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");

	/** Moodle answers status:false with warnings instead of throwing when it refuses a change. */
	function assertOk(raw: unknown, fallback: string) {
		const r = asRecord(raw);
		if (r.status === false) {
			const warning = asRecord((Array.isArray(r.warnings) ? r.warnings[0] : null) ?? {});
			throw new MoodleError("unknown_error", typeof warning.message === "string" && warning.message ? warning.message : fallback);
		}
	}

	async function submissionFields(input: WorkshopSubmissionInput): Promise<MoodleParams> {
		return {
			title: input.title,
			content: input.content,
			contentformat: 1,
			inlineattachmentsid: 0,
			attachmentsid: input.files.length ? await uploadFiles(input.files) : 0,
		};
	}

	return {
		async getWorkshops(courseId) {
			return normalizeWorkshops(await get("mod_workshop_get_workshops_by_courses", { courseids: { 0: courseId } }));
		},

		async getWorkshopAccess(workshop) {
			return normalizeWorkshopAccess(await get("mod_workshop_get_workshop_access_information", { workshopid: workshop.id }), workshop.phase);
		},

		async getWorkshopPlan(workshopId) {
			return normalizeWorkshopPlan(await get("mod_workshop_get_user_plan", { workshopid: workshopId }));
		},

		async getWorkshopSubmissions(workshopId) {
			const me = await userId();
			const [all, mine] = await Promise.all([
				get("mod_workshop_get_submissions", { workshopid: workshopId }).then(normalizeWorkshopSubmissions, () => []),
				get("mod_workshop_get_submissions", { workshopid: workshopId, userid: me }).then(normalizeWorkshopSubmissions, () => []),
			]);
			// the unfiltered call may only return the user's own (or nothing) depending on role and phase
			const byId = new Map([...all, ...mine].map((s) => [s.id, s]));
			return [...byId.values()].sort((a, b) => b.timeModified.localeCompare(a.timeModified));
		},

		async getWorkshopSubmission(submissionId) {
			return normalizeWorkshopSubmissionDetail(await get("mod_workshop_get_submission", { submissionid: submissionId }));
		},

		async saveWorkshopSubmission(workshopId, input, submissionId) {
			if (submissionId === undefined) {
				const raw = await post("mod_workshop_add_submission", { workshopid: workshopId, ...(await submissionFields(input)) });
				assertOk(raw, "Moodle didn't accept the submission.");
				return Number(asRecord(raw).submissionid ?? 0);
			}
			assertOk(await post("mod_workshop_update_submission", { submissionid: submissionId, ...(await submissionFields(input)) }), "Moodle didn't accept the changes.");
			return submissionId;
		},

		async deleteWorkshopSubmission(submissionId) {
			assertOk(await post("mod_workshop_delete_submission", { submissionid: submissionId }), "Moodle didn't delete the submission.");
		},

		async getWorkshopReviews(workshopId) {
			return normalizeWorkshopAssessments(await get("mod_workshop_get_reviewer_assessments", { workshopid: workshopId, userid: await userId() }));
		},

		async getWorkshopAssessmentForm(assessmentId, strategy, mode = "assessment") {
			return normalizeAssessmentForm(await get("mod_workshop_get_assessment_form_definition", { assessmentid: assessmentId, mode }), assessmentId, strategy);
		},

		async saveWorkshopAssessment(form, values) {
			const data = Object.fromEntries(assessmentData(form, values).map((d, i) => [i, d]));
			assertOk(await post("mod_workshop_update_assessment", { assessmentid: form.assessmentId, data }), "Moodle didn't accept the assessment.");
		},

		async getWorkshopGrades(workshopId) {
			return normalizeWorkshopGrades(await get("mod_workshop_get_grades", { workshopid: workshopId, userid: await userId() }));
		},

		async getSubmissionAssessments(submissionId) {
			return normalizeWorkshopAssessments(await get("mod_workshop_get_submission_assessments", { submissionid: submissionId }));
		},
	};
}
