import type { MoodleFile } from "@/types/moodle";
import {
	SUPPORTED_STRATEGIES,
	type AssessmentDimension,
	type AssessmentForm,
	type AssessmentValues,
	type PlanTaskStatus,
	type SubmissionPart,
	type Workshop,
	type WorkshopAccess,
	type WorkshopAssessment,
	type WorkshopGrades,
	type WorkshopPhase,
	type WorkshopPlanPhase,
	type WorkshopSubmission,
} from "@/types/workshop";
import { asArray, asRecord } from "./normalize";

const iso = (seconds: unknown) => new Date(Number(seconds ?? 0) * 1000).toISOString();
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const isoOrUndefined = (v: unknown) => (Number(v) > 0 ? iso(v) : undefined);
/** Moodle sends grades as numbers, numeric strings or null; null means "not graded yet". */
const num = (v: unknown): number | undefined => {
	if (v === null || v === undefined || v === "") return undefined;
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
};
const flag = (v: unknown, fallback: boolean) => (v === undefined || v === null ? fallback : Boolean(Number(v)) || v === true);

const PHASES: Record<number, WorkshopPhase> = { 10: "setup", 20: "submission", 30: "assessment", 40: "evaluation", 50: "closed" };

/** Phase from Moodle's numeric code (0 = not yet switched, treated as setup). */
export function workshopPhase(code: unknown): WorkshopPhase {
	return PHASES[Number(code)] ?? "setup";
}

/** Submission types come as 0 off / 1 available / 2 required; older sites only have attachments. */
function submissionPart(value: unknown, fallback: SubmissionPart): SubmissionPart {
	if (value === undefined || value === null) return fallback;
	return ["off", "optional", "required"][Number(value)] as SubmissionPart | undefined ?? fallback;
}

// mod_workshop_get_workshops_by_courses
export function normalizeWorkshops(raw: unknown): Workshop[] {
	return asArray(asRecord(raw).workshops).map((w) => {
		const r = asRecord(w);
		const attachments = Number(r.nattachments ?? 0);
		return {
			id: Number(r.id),
			cmid: Number(r.coursemodule ?? r.cmid ?? 0),
			courseId: Number(r.course ?? 0),
			name: String(r.name ?? ""),
			intro: str(r.intro),
			instructAuthors: str(r.instructauthors),
			instructReviewers: str(r.instructreviewers),
			conclusion: str(r.conclusion),
			strategy: String(r.strategy ?? "accumulative"),
			phase: workshopPhase(r.phase),
			text: submissionPart(r.submissiontypetext, "optional"),
			files: submissionPart(r.submissiontypefile, attachments > 0 ? "optional" : "off"),
			maxAttachments: attachments,
			maxBytes: Number(r.maxbytes) > 0 ? Number(r.maxbytes) : undefined,
			lateSubmissions: flag(r.latesubmissions, false),
			usePeerAssessment: flag(r.usepeerassessment, true),
			useSelfAssessment: flag(r.useselfassessment, false),
			grade: num(r.grade) ?? 80,
			gradingGrade: num(r.gradinggrade) ?? 20,
			submissionEnd: isoOrUndefined(r.submissionend),
			assessmentEnd: isoOrUndefined(r.assessmentend),
		};
	});
}

// mod_workshop_get_workshop_access_information
export function normalizeWorkshopAccess(raw: unknown, phase: WorkshopPhase): WorkshopAccess {
	const r = asRecord(raw);
	const canSubmit = Boolean(r.cansubmit);
	const canAssess = Boolean(r.canpeerassess);
	return {
		canSubmit,
		canAssess,
		canViewAllSubmissions: Boolean(r.canviewallsubmissions),
		canViewAuthorNames: Boolean(r.canviewauthornames),
		canViewReviewerNames: Boolean(r.canviewreviewernames),
		canViewAllAssessments: Boolean(r.canviewallassessments),
		// the *allowed flags are missing on older sites: derive them from the phase
		canCreateSubmission: r.creatingsubmissionallowed === undefined ? canSubmit && phase === "submission" : Boolean(r.creatingsubmissionallowed),
		canModifySubmission: r.modifyingsubmissionallowed === undefined ? canSubmit && phase === "submission" : Boolean(r.modifyingsubmissionallowed),
		canAssessNow: r.assessingallowed === undefined ? canAssess && phase === "assessment" : Boolean(r.assessingallowed),
	};
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

function taskStatus(completed: unknown): PlanTaskStatus {
	const c = String(completed ?? "").toLowerCase();
	if (["y", "1", "true", "done"].includes(c)) return "done";
	if (["n", "0", "false", "todo"].includes(c)) return "todo";
	if (c === "fail") return "fail";
	return "info";
}

// mod_workshop_get_user_plan
export function normalizeWorkshopPlan(raw: unknown): WorkshopPlanPhase[] {
	return asArray(asRecord(asRecord(raw).userplan).phases).map((p) => {
		const r = asRecord(p);
		return {
			code: Number(r.code),
			phase: workshopPhase(r.code),
			title: stripTags(String(r.title ?? "")),
			active: Boolean(r.active),
			tasks: asArray(r.tasks).map((t) => {
				const task = asRecord(t);
				return {
					title: stripTags(String(task.title ?? "")),
					status: taskStatus(task.completed),
					details: str(task.details) && stripTags(String(task.details)) || undefined,
					link: str(task.link),
				};
			}),
		};
	});
}

function normalizeFiles(raw: unknown): MoodleFile[] {
	return asArray(raw)
		.map(asRecord)
		.filter((a) => typeof a.fileurl === "string")
		.map((a) => ({ name: String(a.filename ?? ""), url: String(a.fileurl), size: Number(a.filesize ?? 0), mimeType: str(a.mimetype) }));
}

/** One submission record (from get_submissions or get_submission, which adds the file lists). */
export function normalizeWorkshopSubmission(raw: unknown): WorkshopSubmission {
	const r = asRecord(raw);
	return {
		id: Number(r.id),
		authorId: Number(r.authorid ?? 0),
		title: String(r.title ?? ""),
		content: typeof r.content === "string" ? r.content : "",
		timeCreated: iso(r.timecreated),
		timeModified: iso(r.timemodified),
		grade: num(r.grade),
		gradeOverride: num(r.gradeover),
		feedback: str(r.feedbackauthor),
		published: Boolean(r.published),
		late: Boolean(Number(r.late ?? 0)),
		files: normalizeFiles(r.attachmentfiles),
	};
}

// mod_workshop_get_submissions (example submissions are teacher-only reference material)
export function normalizeWorkshopSubmissions(raw: unknown): WorkshopSubmission[] {
	return asArray(asRecord(raw).submissions)
		.filter((s) => !Number(asRecord(s).example ?? 0))
		.map(normalizeWorkshopSubmission);
}

// mod_workshop_get_submission
export function normalizeWorkshopSubmissionDetail(raw: unknown): WorkshopSubmission {
	return normalizeWorkshopSubmission(asRecord(raw).submission);
}

// mod_workshop_get_reviewer_assessments / get_submission_assessments
export function normalizeWorkshopAssessments(raw: unknown): WorkshopAssessment[] {
	return asArray(asRecord(raw).assessments).map((a) => {
		const r = asRecord(a);
		return {
			id: Number(r.id),
			submissionId: Number(r.submissionid),
			reviewerId: Number(r.reviewerid ?? 0),
			weight: num(r.weight) ?? 1,
			timeModified: iso(r.timemodified),
			grade: num(r.grade),
			gradingGrade: num(r.gradinggradeover) ?? num(r.gradinggrade),
			feedbackAuthor: str(r.feedbackauthor),
			feedbackReviewer: str(r.feedbackreviewer),
		};
	});
}

// mod_workshop_get_grades: gradebook cells, `{grade, hidden}` (or a bare number on odd sites)
export function normalizeWorkshopGrades(raw: unknown): WorkshopGrades {
	const r = asRecord(raw);
	const cell = (v: unknown) => {
		if (v && typeof v === "object") {
			const c = v as Record<string, unknown>;
			return Number(c.hidden) ? undefined : num(c.grade);
		}
		return num(v);
	};
	return { submission: cell(r.submissiongrade), assessment: cell(r.assessmentgrade) };
}

// mod_workshop_get_assessment_form_definition

const IDX = /^(.+?)__idx_(\d+)(.*)$/;

/** Groups `{name: "grade__idx_2", value}` pairs into one record per dimension index. */
function groupByIndex(entries: Record<string, unknown>[]): Map<number, Record<string, unknown>> {
	const out = new Map<number, Record<string, unknown>>();
	for (const e of entries) {
		const m = typeof e.name === "string" ? IDX.exec(e.name) : null;
		if (!m) continue;
		out.set(Number(m[2]), { ...out.get(Number(m[2])), [m[1] + m[3]]: e.value });
	}
	return out;
}

function scaleItems(v: unknown): string[] | undefined {
	const items = Array.isArray(v) ? v.map((i) => (i && typeof i === "object" ? String((i as Record<string, unknown>).name ?? (i as Record<string, unknown>).label ?? "") : String(i))) : typeof v === "string" ? v.split(",") : [];
	const clean = items.map((s) => s.trim()).filter(Boolean);
	return clean.length ? clean : undefined;
}

function dimensionFrom(def: Record<string, unknown>, cur: Record<string, unknown>, index: number, strategy: string): AssessmentDimension | null {
	const dim: AssessmentDimension = {
		index,
		id: Number(def.dimensionid ?? def.id ?? cur.dimensionid ?? 0),
		description: typeof def.description === "string" ? def.description : "",
		weight: num(def.weight),
		comment: typeof cur.peercomment === "string" ? cur.peercomment : typeof def.peercomment === "string" ? def.peercomment : undefined,
	};
	if (strategy === "accumulative") {
		const grade = num(def.max) ?? num(def.grade);
		if (grade !== undefined && grade > 0) dim.maxGrade = grade;
		else {
			dim.scale = scaleItems(def.scale ?? def.scaleitems);
			if (!dim.scale) return null; // a scale grade without its items
		}
		dim.grade = num(cur.grade);
	} else if (strategy === "numerrors") {
		dim.labels = [str(def.grade0) ?? "No", str(def.grade1) ?? "Yes"];
		dim.grade = num(cur.grade);
	} else if (strategy === "rubric") {
		dim.levels = asArray(def.levels).map(asRecord).map((l) => ({ id: Number(l.id), grade: num(l.grade) ?? 0, definition: String(l.definition ?? "") }));
		if (!dim.levels.length) return null;
		dim.chosenLevel = num(cur.chosenlevelid ?? cur.chosenlevel);
	}
	return dim;
}

export function normalizeAssessmentForm(raw: unknown, assessmentId: number, strategy: string): AssessmentForm {
	const r = asRecord(raw);
	const fields = asArray(r.fields).map(asRecord);
	const current = asArray(r.current).map(asRecord);

	// definitions are one object per dimension, or flat name/value pairs like the form itself
	const objects = fields.filter((f) => f.dimensionid !== undefined);
	const defs = objects.length ? new Map(objects.map((f, i) => [i, f] as const)) : groupByIndex(fields);
	const values = groupByIndex(current);
	const own = new Map(current.filter((c) => c.dimensionid !== undefined).map((c, i) => [i, c] as const));

	const feedback = current.find((c) => c.name === "feedbackauthor" || c.name === "feedbackauthor_editor")?.value;
	const dimensions: AssessmentDimension[] = [];
	let supported = (SUPPORTED_STRATEGIES as readonly string[]).includes(strategy) && defs.size > 0;
	for (const [index, def] of [...defs].sort((a, b) => a[0] - b[0])) {
		const dim = supported ? dimensionFrom(def, values.get(index) ?? own.get(index) ?? {}, index, strategy) : null;
		if (dim) dimensions.push(dim);
		else supported = false;
	}
	return { assessmentId, strategy, dimensions, feedback: typeof feedback === "string" ? feedback : "", supported };
}

/** The `data` name/value list mod_workshop_update_assessment expects, in the form's own field names. */
export function assessmentData(form: AssessmentForm, values: AssessmentValues): { name: string; value: string | number }[] {
	const out: { name: string; value: string | number }[] = [{ name: "feedbackauthor_editor", value: values.feedback }];
	for (const dim of form.dimensions) {
		const v = values.dimensions[dim.index] ?? {};
		const key = (name: string) => `${name}__idx_${dim.index}`;
		out.push({ name: key("dimensionid"), value: dim.id });
		if (form.strategy === "rubric") out.push({ name: key("chosenlevelid"), value: v.chosenLevel ?? 0 });
		else if (form.strategy !== "comments") out.push({ name: key("grade"), value: v.grade ?? 0 });
		out.push({ name: key("peercomment"), value: v.comment ?? "" }, { name: key("peercommentformat"), value: 1 });
	}
	return out;
}

/** The form's current answers, as the editable state. */
export function assessmentValues(form: AssessmentForm): AssessmentValues {
	return {
		feedback: form.feedback,
		dimensions: Object.fromEntries(form.dimensions.map((d) => [d.index, { grade: d.grade, chosenLevel: d.chosenLevel, comment: d.comment }])),
	};
}

/** Whether every dimension that needs a grade or level has one. */
export function isAssessmentComplete(form: AssessmentForm, values: AssessmentValues): boolean {
	return form.dimensions.every((d) => {
		const v = values.dimensions[d.index];
		if (form.strategy === "rubric") return v?.chosenLevel !== undefined;
		if (form.strategy === "comments") return true;
		return v?.grade !== undefined;
	});
}
