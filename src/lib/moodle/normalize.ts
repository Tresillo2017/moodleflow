import { MoodleError } from "@/types/moodle";
import type {
	ActivityType,
	AssignmentConfig,
	AssignmentSubmission,
	SubmissionStatus,
	MoodleAssignment,
	MoodleCalendarEvent,
	MoodleCourse,
	MoodleCourseContent,
	MoodleCourseGrades,
	MoodleFile,
	MoodleForumDiscussion,
	MoodleNotification,
	MoodleSiteInfo,
} from "@/types/moodle";

/**
 * Normalizers translate raw Moodle Web Service payloads (which vary by
 * Moodle version and enabled plugins) into MoodleFlow's stable domain
 * types. Keep raw Moodle field names contained to this file.
 */

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object") {
		throw new MoodleError("malformed_response", "Expected a Moodle object response.");
	}
	return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
	if (!Array.isArray(value)) return [];
	return value;
}

// core_webservice_get_site_info
export function normalizeSiteInfo(raw: unknown): MoodleSiteInfo {
	const r = asRecord(raw);
	return {
		siteName: String(r.sitename ?? ""),
		siteUrl: String(r.siteurl ?? ""),
		userId: Number(r.userid ?? 0),
		username: String(r.username ?? ""),
		fullName: String(r.fullname ?? ""),
		userPictureUrl: r.userpictureurl ? String(r.userpictureurl) : undefined,
		release: String(r.release ?? ""),
		functions: asArray(r.functions)
			.map((f) => asRecord(f).name)
			.filter((n): n is string => typeof n === "string"),
	};
}

// core_enrol_get_users_courses
export function normalizeCourses(raw: unknown): MoodleCourse[] {
	return asArray(raw).map((c) => {
		const r = asRecord(c);
		return {
			id: Number(r.id),
			shortName: String(r.shortname ?? ""),
			fullName: String(r.fullname ?? r.shortname ?? ""),
			summary: r.summary ? String(r.summary) : undefined,
			imageUrl: typeof r.courseimage === "string" ? r.courseimage : undefined,
			progress: typeof r.progress === "number" ? r.progress : undefined,
			startDate: r.startdate ? new Date(Number(r.startdate) * 1000).toISOString() : undefined,
			endDate: r.enddate ? new Date(Number(r.enddate) * 1000).toISOString() : undefined,
			isFavourite: Boolean(r.isfavourite),
			visible: r.visible === undefined ? true : Boolean(r.visible),
		};
	});
}

const MODNAME_TO_TYPE: Record<string, ActivityType> = {
	assign: "assignment",
	quiz: "quiz",
	resource: "resource",
	page: "page",
	forum: "forum",
	url: "url",
	lesson: "lesson",
	feedback: "feedback",
	folder: "folder",
};

function normalizeFiles(contents: unknown): MoodleFile[] {
	return asArray(contents)
		.map(asRecord)
		.filter((f) => f.type === "file" && typeof f.fileurl === "string")
		.map((f) => ({
			name: String(f.filename ?? ""),
			url: String(f.fileurl),
			size: Number(f.filesize ?? 0),
			mimeType: typeof f.mimetype === "string" ? f.mimetype : undefined,
		}));
}

// core_course_get_contents
export function normalizeCourseContent(courseId: number, raw: unknown): MoodleCourseContent {
	const sections = asArray(raw).map((s) => {
		const r = asRecord(s);
		const activities = asArray(r.modules).map((m) => {
			const mod = asRecord(m);
			const modname = String(mod.modname ?? "");
			return {
				id: Number(mod.id),
				instance: mod.instance !== undefined ? Number(mod.instance) : undefined,
				files: normalizeFiles(mod.contents),
				courseId,
				sectionId: Number(r.id),
				type: MODNAME_TO_TYPE[modname] ?? "unknown",
				name: String(mod.name ?? ""),
				description: mod.description ? String(mod.description) : undefined,
				url: typeof mod.url === "string" ? mod.url : undefined,
				completed: mod.completiondata
					? asRecord(mod.completiondata).state === 1
					: undefined,
				visible: mod.visible === undefined ? true : Boolean(mod.visible),
			};
		});
		return {
			id: Number(r.id),
			name: String(r.name ?? ""),
			summary: r.summary ? String(r.summary) : undefined,
			activities,
		};
	});
	return { courseId, sections };
}

// core_calendar_get_calendar_upcoming_view
export function normalizeCalendarEvents(raw: unknown): MoodleCalendarEvent[] {
	const r = asRecord(raw);
	return asArray(r.events).map((e) => {
		const ev = asRecord(e);
		return {
			id: Number(ev.id),
			name: String(ev.name ?? ""),
			description: ev.description ? String(ev.description) : undefined,
			courseId: ev.courseid ? Number(ev.courseid) : undefined,
			courseName:
				ev.course && typeof ev.course === "object"
					? String(asRecord(ev.course).fullname ?? "")
					: undefined,
			startDate: new Date(Number(ev.timestart ?? 0) * 1000).toISOString(),
			endDate:
				ev.timestart && ev.timeduration
					? new Date((Number(ev.timestart) + Number(ev.timeduration)) * 1000).toISOString()
					: undefined,
			type: (ev.eventtype === "due" ? "assignment" : "other") as MoodleCalendarEvent["type"],
			url: typeof ev.url === "string" ? ev.url : undefined,
		};
	});
}

function mapFile(f: unknown): MoodleFile {
	const r = asRecord(f);
	return {
		name: String(r.filename ?? ""),
		url: String(r.fileurl ?? ""),
		size: Number(r.filesize ?? 0),
		mimeType: typeof r.mimetype === "string" ? r.mimetype : undefined,
	};
}

const iso = (seconds: unknown): string | undefined => {
	const n = Number(seconds ?? 0);
	return n > 0 ? new Date(n * 1000).toISOString() : undefined;
};

function assignConfig(assign: Record<string, unknown>): AssignmentConfig {
	const configs = asArray(assign.configs).map(asRecord);
	const get = (plugin: string, name: string) =>
		configs.find((c) => c.plugin === plugin && c.subtype === "assignsubmission" && c.name === name)?.value;
	const noConfigs = configs.length === 0;
	const maxFiles = Number(get("file", "maxfilesubmissions"));
	const maxBytes = Number(get("file", "maxsubmissionsizebytes"));
	return {
		acceptsText: noConfigs ? true : String(get("onlinetext", "enabled")) === "1",
		acceptsFiles: noConfigs ? false : String(get("file", "enabled")) === "1",
		maxFiles: maxFiles > 0 ? maxFiles : undefined,
		maxFileBytes: maxBytes > 0 ? maxBytes : undefined,
		requiresSubmitAction: Number(assign.submissiondrafts ?? 0) === 1,
		requiresStatement: Number(assign.requiresubmissionstatement ?? 0) === 1,
	};
}

// mod_assign_get_assignments (status stays "unknown" until applySubmissionStatus)
export function normalizeAssignments(raw: unknown): MoodleAssignment[] {
	const r = asRecord(raw);
	const assignments: MoodleAssignment[] = [];
	for (const course of asArray(r.courses)) {
		const c = asRecord(course);
		for (const a of asArray(c.assignments)) {
			const assign = asRecord(a);
			assignments.push({
				id: Number(assign.id),
				courseId: Number(c.id),
				courseName: String(c.fullname ?? ""),
				name: String(assign.name ?? ""),
				description: assign.intro ? String(assign.intro) : undefined,
				introFiles: asArray(assign.introattachments).map(mapFile),
				dueDate: iso(assign.duedate),
				cutoffDate: iso(assign.cutoffdate),
				maxGrade: Number(assign.grade) > 0 ? Number(assign.grade) : undefined,
				status: "unknown",
				config: assignConfig(assign),
			});
		}
	}
	return assignments;
}

export function deriveSubmissionStatus(p: {
	submissionStatus?: string;
	graded: boolean;
	dueDate?: string;
	submittedAt?: string;
	now?: number;
}): SubmissionStatus {
	if (p.graded) return "graded";
	if (p.submissionStatus === "submitted") {
		const late = p.dueDate && p.submittedAt && new Date(p.submittedAt) > new Date(p.dueDate);
		return late ? "late" : "submitted";
	}
	if (p.submissionStatus === "draft") return "draft";
	const overdue = p.dueDate && new Date(p.dueDate).getTime() < (p.now ?? Date.now());
	return overdue ? "overdue" : "not_started";
}

function editorText(plugin: Record<string, unknown>, field: string): string | undefined {
	const editor = asArray(plugin.editorfields)
		.map(asRecord)
		.find((e) => e.name === field);
	return editor?.text ? String(editor.text) : undefined;
}

function pluginFiles(plugin: Record<string, unknown>): MoodleFile[] {
	return asArray(plugin.fileareas).flatMap((area) => asArray(asRecord(area).files).map(mapFile));
}

// mod_assign_get_submission_status
export function applySubmissionStatus(assignment: MoodleAssignment, raw: unknown): MoodleAssignment {
	const r = asRecord(raw);
	const last = r.lastattempt ? asRecord(r.lastattempt) : {};
	const sub = last.submission ? asRecord(last.submission) : undefined;
	const feedback = r.feedback ? asRecord(r.feedback) : undefined;

	const plugins = asArray(sub?.plugins).map(asRecord);
	const submission: AssignmentSubmission | undefined = sub
		? {
				status: String(sub.status ?? "new") as AssignmentSubmission["status"],
				timeModified: iso(sub.timemodified),
				text: plugins.map((p) => (p.type === "onlinetext" ? editorText(p, "onlinetext") : undefined)).find(Boolean),
				files: plugins.filter((p) => p.type === "file").flatMap(pluginFiles),
			}
		: undefined;

	const gradeRecord = feedback?.grade ? asRecord(feedback.grade) : undefined;
	const rawGrade = gradeRecord?.grade !== undefined ? Number(gradeRecord.grade) : NaN;
	const graded = Number.isFinite(rawGrade) && rawGrade >= 0;
	const feedbackPlugins = asArray(feedback?.plugins).map(asRecord);

	return {
		...assignment,
		status: deriveSubmissionStatus({
			submissionStatus: submission?.status,
			graded,
			dueDate: assignment.dueDate,
			submittedAt: submission?.timeModified,
		}),
		submission,
		canEdit: last.canedit === undefined ? undefined : Boolean(last.canedit),
		grade: graded ? rawGrade : undefined,
		gradedDate: iso(feedback?.gradeddate),
		feedback: feedbackPlugins.map((p) => (p.type === "comments" ? editorText(p, "comments") : undefined)).find(Boolean),
		feedbackFiles: feedbackPlugins.filter((p) => p.type === "file").flatMap(pluginFiles),
	};
}

// mod_forum_get_forum_discussions
export function normalizeForumDiscussions(raw: unknown): MoodleForumDiscussion[] {
	return asArray(asRecord(raw).discussions).map((d) => {
		const disc = asRecord(d);
		return {
			id: Number(disc.discussion ?? disc.id),
			subject: String(disc.subject ?? disc.name ?? ""),
			author: String(disc.userfullname ?? ""),
			timeModified: new Date(Number(disc.timemodified ?? 0) * 1000).toISOString(),
			replies: Number(disc.numreplies ?? 0),
			pinned: Boolean(disc.pinned),
		};
	});
}

// message_popup_get_popup_notifications
export function normalizeNotifications(raw: unknown): MoodleNotification[] {
	const r = asRecord(raw);
	return asArray(r.notifications).map((n) => {
		const notif = asRecord(n);
		return {
			id: Number(notif.id),
			subject: String(notif.subject ?? ""),
			body: notif.fullmessagehtml ? String(notif.fullmessagehtml) : undefined,
			read: Boolean(notif.read),
			timeCreated: new Date(Number(notif.timecreated ?? 0) * 1000).toISOString(),
			courseId: notif.courseid ? Number(notif.courseid) : undefined,
			url: typeof notif.contexturl === "string" && notif.contexturl ? notif.contexturl : undefined,
		};
	});
}

function parsePercent(value: unknown): number | undefined {
	const n = parseFloat(String(value ?? ""));
	return Number.isFinite(n) ? n : undefined;
}

// gradereport_user_get_grade_items
export function normalizeGrades(raw: unknown): MoodleCourseGrades[] {
	const r = asRecord(raw);
	return asArray(r.usergrades).map((g) => {
		const grade = asRecord(g);
		const items = asArray(grade.gradeitems).map((i) => {
			const item = asRecord(i);
			return {
				id: Number(item.id),
				itemName: String(item.itemname ?? ""),
				grade: item.graderaw !== null && item.graderaw !== undefined ? Number(item.graderaw) : undefined,
				maxGrade: item.grademax !== undefined ? Number(item.grademax) : undefined,
				percentage: parsePercent(item.percentageformatted ?? item.gradepercentage),
				letterGrade: item.gradeletter ? String(item.gradeletter) : undefined,
				feedback: item.feedback ? String(item.feedback) : undefined,
				gradedDate:
					typeof item.dategraded === "number" && item.dategraded > 0
						? new Date(item.dategraded * 1000).toISOString()
						: undefined,
			};
		});
		return {
			courseId: Number(grade.courseid),
			courseName: String(grade.coursename ?? ""),
			items,
		};
	});
}
