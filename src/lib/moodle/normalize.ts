import { MoodleError } from "@/types/moodle";
import type {
	BookChapter,
	CourseBlock,
	CourseCompletion,
	MoodleParticipant,
	ActivityType,
	AssignmentConfig,
	AssignmentSubmission,
	SubmissionStatus,
	MoodleAssignment,
	MoodleCalendarEvent,
	MoodleCourse,
	MoodleCourseContent,
	MoodleComment,
	MoodleCourseGrades,
	MoodleFile,
	MoodleNotification,
	MoodleSiteConfig,
	MoodleSiteInfo,
} from "@/types/moodle";

/**
 * Normalizers translate raw Moodle Web Service payloads (which vary by
 * Moodle version and enabled plugins) into MoodleFlow's stable domain
 * types. Keep raw Moodle field names contained to this file.
 */

export function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object") {
		throw new MoodleError("malformed_response", "Expected a Moodle object response.");
	}
	return value as Record<string, unknown>;
}

export function asArray(value: unknown): unknown[] {
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
		maxUploadBytes: Number(r.usermaxuploadfilesize) > 0 ? Number(r.usermaxuploadfilesize) : undefined,
		functions: asArray(r.functions)
			.map((f) => asRecord(f).name)
			.filter((n): n is string => typeof n === "string"),
	};
}

/** Merges tool_mobile_get_config (`{settings: [{name, value}]}`, may be null) over what site info already told us. */
export function normalizeSiteConfig(raw: unknown, info: MoodleSiteInfo): MoodleSiteConfig {
	const settings = Object.fromEntries(
		asArray(raw ? asRecord(raw).settings : []).map((s) => [String(asRecord(s).name), String(asRecord(s).value ?? "")]),
	);
	return {
		siteName: settings.sitename || info.siteName,
		logoUrl: settings.compactlogourl || settings.logourl || undefined,
		maxUploadBytes: info.maxUploadBytes,
		registrationEnabled: Boolean(settings.registerauth),
		policyUrl: settings.sitepolicy || undefined,
	};
}

/** Course images from the timeline API, keyed by course id (it also serves Moodle's generated default images). */
export function normalizeTimelineImages(raw: unknown): Map<number, string> {
	const images = new Map<number, string>();
	for (const c of asArray(asRecord(raw).courses).map(asRecord)) {
		if (typeof c.courseimage === "string" && c.courseimage) images.set(Number(c.id), c.courseimage);
	}
	return images;
}

/** `courseimage` (timeline/overview APIs) or the first overview file (core_enrol_get_users_courses). */
function courseImage(course: Record<string, unknown>): string | undefined {
	if (typeof course.courseimage === "string" && course.courseimage) return course.courseimage;
	const file = asArray(course.overviewfiles)
		.map(asRecord)
		.find((f) => typeof f.fileurl === "string" && (!f.mimetype || String(f.mimetype).startsWith("image/")));
	return file ? String(file.fileurl) : undefined;
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
			imageUrl: courseImage(r),
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
	label: "label",
	book: "book",
	imscp: "imscp",
	chat: "chat",
	bigbluebuttonbn: "bigbluebuttonbn",
	workshop: "workshop",
	choice: "choice",
	survey: "survey",
	wiki: "wiki",
	glossary: "glossary",
	data: "data",
	h5pactivity: "h5pactivity",
	scorm: "scorm",
	lti: "lti",
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
			path: typeof f.filepath === "string" && f.filepath !== "/" ? f.filepath : undefined,
		}));
}

/** Book and IMS package contents carry the table of contents as a JSON "structure" entry (possibly nested via subitems). */
function normalizeChapters(contents: unknown): BookChapter[] | undefined {
	const entry = asArray(contents).map(asRecord).find((c) => c.filename === "structure" && typeof c.content === "string");
	if (!entry) return undefined;
	const flatten = (items: unknown[], depth: number): BookChapter[] =>
		items.map(asRecord).flatMap((c) => [
			{ title: String(c.title ?? ""), href: String(c.href ?? ""), level: Number(c.level ?? depth) },
			...flatten(asArray(c.subitems), depth + 1),
		]);
	try {
		return flatten(asArray(JSON.parse(String(entry.content))), 0);
	} catch {
		return undefined;
	}
}

/** URL activities keep the external link as their only content entry. */
function normalizeExternalUrl(contents: unknown): string | undefined {
	const entry = asArray(contents).map(asRecord).find((c) => c.type === "url" && typeof c.fileurl === "string");
	return entry ? String(entry.fileurl) : undefined;
}

function normalizeCompletionDetails(data: unknown): string[] | undefined {
	if (!data || typeof data !== "object") return undefined;
	const details = asArray((data as Record<string, unknown>).details)
		.map((d) => asRecord(d).rulevalue)
		.map((v) => (v && typeof v === "object" ? (v as Record<string, unknown>).description : undefined))
		.filter((d): d is string => typeof d === "string" && d !== "");
	return details.length ? details : undefined;
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
				manualCompletion: mod.completion === 1 ? true : undefined,
				externalUrl: modname === "url" ? normalizeExternalUrl(mod.contents) : undefined,
				chapters: modname === "book" || modname === "imscp" ? normalizeChapters(mod.contents) : undefined,
				completionDetails: normalizeCompletionDetails(mod.completiondata),
				locked: mod.uservisible === false ? true : undefined,
				availabilityInfo: typeof mod.availabilityinfo === "string" ? mod.availabilityinfo : undefined,
				visible: mod.visible === undefined ? true : Boolean(mod.visible),
			};
		});
		return {
			id: Number(r.id),
			name: String(r.name ?? ""),
			summary: r.summary ? String(r.summary) : undefined,
			locked: r.uservisible === false ? true : undefined,
			availabilityInfo: typeof r.availabilityinfo === "string" ? r.availabilityinfo : undefined,
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
				cmid: assign.cmid !== undefined ? Number(assign.cmid) : undefined,
				openDate: iso(assign.allowsubmissionsfromdate),
				dueDate: iso(assign.duedate),
				cutoffDate: iso(assign.cutoffdate),
				isGroup: Number(assign.teamsubmission ?? 0) === 1,
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
	// Group assignments: the shared team submission is the one that counts.
	const rawSub = last.teamsubmission ?? last.submission;
	const sub = rawSub ? asRecord(rawSub) : undefined;
	const extension = iso(last.extensionduedate);
	const extended = extension && (!assignment.dueDate || extension > assignment.dueDate);
	const dueDate = extended ? extension : assignment.dueDate;
	const feedback = r.feedback ? asRecord(r.feedback) : undefined;

	const plugins = asArray(sub?.plugins).map(asRecord);
	const submission: AssignmentSubmission | undefined = sub
		? {
				id: sub.id !== undefined ? Number(sub.id) : undefined,
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
		dueDate,
		originalDueDate: extended ? assignment.dueDate : undefined,
		status: deriveSubmissionStatus({
			submissionStatus: submission?.status,
			graded,
			dueDate,
			submittedAt: submission?.timeModified,
		}),
		submission,
		canEdit: last.canedit === undefined ? undefined : Boolean(last.canedit),
		grade: graded ? rawGrade : undefined,
		gradedDate: iso(feedback?.gradeddate),
		gradingDetails: /<[a-z]/i.test(String(feedback?.gradefordisplay ?? "")) ? String(feedback?.gradefordisplay) : undefined,
		feedback: feedbackPlugins.map((p) => (p.type === "comments" ? editorText(p, "comments") : undefined)).find(Boolean),
		feedbackFiles: feedbackPlugins.filter((p) => p.type === "file").flatMap(pluginFiles),
	};
}

// core_completion_get_activities_completion_status
export function normalizeActivityCompletion(raw: unknown, cmid: number): MoodleAssignment["completion"] {
	const status = asArray(asRecord(raw).statuses)
		.map(asRecord)
		.find((s) => Number(s.cmid) === cmid);
	if (!status || Number(status.tracking ?? 0) === 0) return undefined;
	const done = Number(status.state) === 1 || Number(status.state) === 2;
	const details = asArray(status.details).map(asRecord);
	const rule = details.find((d) => d.rulevalue && Number(asRecord(d.rulevalue).status) === (done ? 1 : 0)) ?? details[0];
	const label = rule?.rulevalue ? String(asRecord(rule.rulevalue).description ?? "") : "";
	return { done, label: label || undefined };
}

// core_completion_get_activities_completion_status: when each activity was completed
export function normalizeCompletionDates(raw: unknown): string[] {
	return asArray(asRecord(raw).statuses)
		.map(asRecord)
		.filter((s) => Number(s.timecompleted) > 0)
		.map((s) => new Date(Number(s.timecompleted) * 1000).toISOString());
}

// core_comment_get_comments
export function normalizeComments(raw: unknown): MoodleComment[] {
	return asArray(asRecord(raw).comments).map((c) => {
		const r = asRecord(c);
		return {
			id: Number(r.id),
			author: String(r.fullname ?? ""),
			content: String(r.content ?? ""),
			time: new Date(Number(r.timecreated ?? 0) * 1000).toISOString(),
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
			component: typeof notif.component === "string" && notif.component ? notif.component : undefined,
			eventType: typeof notif.eventtype === "string" && notif.eventtype ? notif.eventtype : undefined,
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

// core_course_get_user_navigation_options: names of the tabs the user may open (navigation, grades, participants...)
export function normalizeNavOptions(raw: unknown): string[] {
	const course = asArray(asRecord(raw).courses).map(asRecord)[0];
	return asArray(course?.navoptions)
		.map(asRecord)
		.filter((o) => o.available)
		.map((o) => String(o.name));
}

// core_enrol_get_enrolled_users
export function normalizeParticipants(raw: unknown): MoodleParticipant[] {
	return asArray(raw).map((u) => {
		const r = asRecord(u);
		return {
			id: Number(r.id),
			fullName: String(r.fullname ?? ""),
			imageUrl: typeof r.profileimageurlsmall === "string" ? r.profileimageurlsmall : undefined,
			roles: asArray(r.roles).map((x) => String(asRecord(x).name || asRecord(x).shortname || "")).filter(Boolean),
			lastAccess: r.lastcourseaccess ? new Date(Number(r.lastcourseaccess) * 1000).toISOString() : undefined,
			groups: asArray(r.groups).map((g) => ({ id: Number(asRecord(g).id), name: String(asRecord(g).name ?? "") })),
		};
	});
}

// core_completion_get_course_completion_status
export function normalizeCourseCompletion(raw: unknown): CourseCompletion {
	const status = asRecord(asRecord(raw).completionstatus);
	const completions = asArray(status.completions).map(asRecord);
	const SELF = 1; // COMPLETION_CRITERIA_TYPE_SELF
	return {
		completed: Boolean(status.completed),
		criteria: completions.map((c) => ({ title: String(c.title || (c.details && typeof c.details === "object" ? (c.details as Record<string, unknown>).criteria : "") || ""), complete: Boolean(c.complete) })),
		canSelfComplete: completions.some((c) => Number(c.type) === SELF && !c.complete),
	};
}

/** Blocks that duplicate MoodleFlow's own pages or are only useful inside Moodle's UI. */
const HIDDEN_BLOCKS = new Set([
	"navigation", "settings", "myoverview", "timeline", "private_files", "completionstatus", "selfcompletion", "mentees",
	"course_list", "mycourses", "starredcourses", "recentlyaccessedcourses", "recentlyaccesseditems", "calendar_month",
	"admin_bookmarks", "badges", "lp", "comments", "tags", "search_forums", "notes",
]);

// core_block_get_course_blocks
export function normalizeCourseBlocks(raw: unknown): CourseBlock[] {
	return asArray(asRecord(raw).blocks)
		.map(asRecord)
		.filter((b) => !HIDDEN_BLOCKS.has(String(b.name)))
		.map((b) => {
			const contents = b.contents && typeof b.contents === "object" ? (b.contents as Record<string, unknown>) : {};
			return {
				id: Number(b.instanceid),
				name: String(b.name ?? ""),
				title: String(contents.title ?? b.name ?? ""),
				html: String(contents.content ?? ""),
			};
		})
		// some plugins return escaped markup (shows as literal "<div ...>"), which is unreadable
		.filter((b) => b.html.trim() !== "" && !/&lt;\/?[a-z]/i.test(b.html));
}

// core_course_get_updates_since: ids of course modules changed since the timestamp
export function normalizeUpdatedModules(raw: unknown): number[] {
	return asArray(asRecord(raw).instances)
		.map(asRecord)
		.filter((i) => i.contextlevel === "module")
		.map((i) => Number(i.id));
}
