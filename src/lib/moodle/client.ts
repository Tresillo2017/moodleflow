import { MoodleError } from "@/types/moodle";
import { uploadDraftFiles } from "./upload";
import {
	BATCH_FUNCTION,
	callMoodle,
	callMoodleBatch,
	moodleUrl,
	type BatchCall,
	type CallResult,
	type MoodleConnection,
	type MoodleParams,
} from "./call";
import { viewCall, type ViewTarget } from "./views";
import { createSocialApi, type SocialApi } from "./client-social";
import { createQuizApi, type QuizApi } from "./client-quiz";
import { createLessonApi, type LessonApi } from "./client-lesson";
import { createWorkshopApi, type WorkshopApi } from "./client-workshop";
import { createEngageApi, type EngageApi } from "./client-engage";
import { createWikiApi, type WikiApi } from "./client-wiki";
import { createEmbedApi, type EmbedApi } from "./client-embed";
import type {
	CourseBlock,
	CourseCompletion,
	MoodleAssignment,
	MoodleParticipant,
	MoodleCalendarEvent,
	MoodleCourse,
	MoodleCourseContent,
	MoodleComment,
	MoodleCourseGrades,
	MoodleFile,
	MoodleForumDiscussion,
	MoodleNotification,
	MoodleSiteConfig,
	MoodleSiteInfo,
	MoodleUser,
} from "@/types/moodle";
import {
	applySubmissionStatus,
	normalizeActivityCompletion,
	normalizeAssignments,
	normalizeComments,
	normalizeCalendarEvents,
	normalizeCourseContent,
	normalizeCompletionDates,
	normalizeCourseBlocks,
	normalizeCourseCompletion,
	normalizeCourses,
	normalizeNavOptions,
	normalizeParticipants,
	normalizeTimelineImages,
	normalizeUpdatedModules,
	normalizeGrades,
	normalizeNotifications,
	normalizeSiteConfig,
	normalizeSiteInfo,
} from "./normalize";

export interface MoodleClient extends SocialApi, QuizApi, LessonApi, WorkshopApi, EngageApi, EmbedApi, WikiApi {
	getSiteInfo(): Promise<MoodleSiteInfo>;
	/** Site name, logo, upload limit and registration/policy flags; falls back to site info when the site lacks tool_mobile. */
	getSiteConfig(): Promise<MoodleSiteConfig>;
	/**
	 * Whether the site exposes this web service function. Optimistic (true) until the site info has loaded,
	 * so gate UI after `await getSiteInfo()` (see useSupports).
	 */
	supports(wsfunction: string): boolean;
	/** Tells Moodle the user opened this activity/course so view-based completion updates. Best effort, once per session. */
	logActivityView(target: ViewTarget): Promise<boolean>;
	logCourseView(courseId: number): Promise<boolean>;
	/** Uploads files to a new draft area and returns its itemid (for save_submission, forum posts, private files). */
	uploadFiles(files: File[], opts?: { maxBytes?: number; onProgress?: (fraction: number) => void }): Promise<number>;
	getCurrentUser(): Promise<MoodleUser>;
	getCourses(): Promise<MoodleCourse[]>;
	setCourseFavourite(courseId: number, favourite: boolean): Promise<void>;
	getCourseContents(courseId: number): Promise<MoodleCourseContent>;
	/** Manual completion: ticks or unticks "mark as done" for a course module. */
	setActivityCompletion(cmid: number, completed: boolean): Promise<void>;
	/** Tabs the user may open in this course ("grades", "participants", ...); null when the site can't say. */
	getCourseNavOptions(courseId: number): Promise<string[] | null>;
	getParticipants(courseId: number): Promise<MoodleParticipant[]>;
	/** Null when the course has no completion tracking. */
	getCourseCompletion(courseId: number): Promise<CourseCompletion | null>;
	selfCompleteCourse(courseId: number): Promise<void>;
	/** Side blocks with content (announcements, latest news, upcoming events); empty when unsupported. */
	getCourseBlocks(courseId: number): Promise<CourseBlock[]>;
	/** Course-module ids changed since the timestamp (seconds); empty when unsupported. */
	getUpdatedModules(courseId: number, sinceSeconds: number): Promise<number[]>;
	/** Days the user completed activities in these courses (for the activity heatmap); failed courses are skipped. */
	getCompletionDates(courseIds: number[]): Promise<{ courseId: number; date: string }[]>;
	getCalendarEvents(): Promise<MoodleCalendarEvent[]>;
	/** With courseIds, also fetches each assignment's real submission status; without, status is "unknown". */
	getAssignments(courseIds?: number[]): Promise<MoodleAssignment[]>;
	getAssignment(assignmentId: number): Promise<MoodleAssignment | undefined>;
	/** Saves text and/or files (existing MoodleFile entries are re-uploaded so they survive the save). */
	saveAssignmentSubmission(assignment: MoodleAssignment, input: SubmissionInput): Promise<void>;
	submitAssignmentForGrading(assignmentId: number): Promise<void>;
	removeAssignmentSubmission(assignmentId: number): Promise<void>;
	/** Empty when the site has submission comments disabled. */
	getSubmissionComments(assignment: MoodleAssignment): Promise<MoodleComment[]>;
	addSubmissionComment(assignment: MoodleAssignment, content: string): Promise<void>;
	getGrades(courseId?: number): Promise<MoodleCourseGrades[]>;
	/** Adds the auth token to a Moodle file URL so the browser can download it. */
	fileUrl(url: string, opts?: { download?: boolean }): string;
	/** Newest first; with a limit, pages through `offset`. */
	getNotifications(opts?: { limit?: number; offset?: number }): Promise<MoodleNotification[]>;
	markNotificationRead(notificationId: number): Promise<void>;
	markAllNotificationsRead(): Promise<void>;
}

export interface SubmissionInput {
	text?: string;
	files?: (File | MoodleFile)[];
	onProgress?: (fraction: number) => void;
}

export type { MoodleConnection };

const STATUS_CONCURRENCY = 6;

/** Maps in parallel with at most `limit` calls in flight, preserving order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	async function worker() {
		while (next < items.length) {
			const i = next++;
			results[i] = await fn(items[i]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

export function createMoodleClient(connection: MoodleConnection): MoodleClient {
	// Most calls need the user id first; fetch site info once per client instead of per call.
	let siteInfo: Promise<MoodleSiteInfo> | null = null;
	let siteFunctions: Set<string> | null = null;
	const viewed = new Set<string>();

	const fetchSiteInfo = () =>
		(siteInfo ??= callMoodle(connection, "core_webservice_get_site_info")
			.then(normalizeSiteInfo)
			.then((info) => {
				siteFunctions = new Set(info.functions);
				return info;
			})
			.catch((error: unknown) => {
				siteInfo = null;
				throw error;
			}));

	/**
	 * Several calls in one round trip when the site has tool_mobile_call_external_functions,
	 * otherwise (or if the batch request itself fails) parallel single calls. Results keep call order.
	 */
	async function callMany(calls: BatchCall[]): Promise<CallResult[]> {
		const single = (c: BatchCall): Promise<CallResult> =>
			callMoodle(connection, c.wsfunction, c.params).then(
				(data) => ({ data }),
				(error: unknown) => ({ error: error instanceof MoodleError ? error : new MoodleError("unknown_error", "Moodle couldn't complete that request.") }),
			);
		if (calls.length > 1) {
			await fetchSiteInfo().catch(() => {});
			if (siteFunctions?.has(BATCH_FUNCTION)) {
				try {
					return await callMoodleBatch(connection, calls);
				} catch {
					// fall through to single calls
				}
			}
		}
		return mapLimit(calls, STATUS_CONCURRENCY, single);
	}

	async function quietView(key: string, wsfunction: string, params: MoodleParams): Promise<boolean> {
		if (viewed.has(key)) return false;
		await fetchSiteInfo().catch(() => {});
		if (siteFunctions && !siteFunctions.has(wsfunction)) return false;
		viewed.add(key);
		try {
			await callMoodle(connection, wsfunction, params, "POST");
			return true;
		} catch {
			viewed.delete(key); // retry on the next open
			return false;
		}
	}

	/** Activity completion ("Done: Make a submission"); optional, so failures are ignored. */
	async function completionOf(assignment: MoodleAssignment): Promise<MoodleAssignment["completion"]> {
		if (assignment.cmid === undefined) return undefined;
		try {
			const info = await fetchSiteInfo();
			const raw = await callMoodle(connection, "core_completion_get_activities_completion_status", {
				courseid: assignment.courseId,
				userid: info.userId,
			});
			return normalizeActivityCompletion(raw, assignment.cmid);
		} catch {
			return undefined;
		}
	}

	const commentTarget = (a: MoodleAssignment) => ({
		contextlevel: "module",
		instanceid: a.cmid ?? 0,
		component: "assignsubmission_comments",
		itemid: a.submission?.id ?? 0,
		area: "submission_comments",
	});

	const socialCtx = {
		connection,
		userId: () => fetchSiteInfo().then((info) => info.userId),
		uploadFiles: (files: File[]) => uploadFiles(files),
	};

	async function uploadFiles(files: File[], opts?: { maxBytes?: number; onProgress?: (fraction: number) => void }) {
		const info = await fetchSiteInfo();
		return uploadDraftFiles(connection, files, { maxBytes: opts?.maxBytes ?? info.maxUploadBytes, onProgress: opts?.onProgress });
	}

	return {
		...createSocialApi(socialCtx),
		...createQuizApi(socialCtx),
		...createLessonApi(socialCtx),
		...createWorkshopApi(socialCtx),
		...createEngageApi(socialCtx),
		...createWikiApi(socialCtx),
		...createEmbedApi(socialCtx),
		getSiteInfo: fetchSiteInfo,

		supports: (wsfunction) => siteFunctions?.has(wsfunction) ?? true,

		async getSiteConfig() {
			const info = await fetchSiteInfo();
			const config = siteFunctions?.has("tool_mobile_get_config")
				? await callMoodle(connection, "tool_mobile_get_config").catch(() => null)
				: null;
			return normalizeSiteConfig(config, info);
		},

		async logActivityView(target: ViewTarget) {
			const call = viewCall(target);
			return call ? quietView(`${target.type}:${target.instance}`, call.wsfunction, call.params) : false;
		},

		logCourseView: (courseId) => quietView(`course:${courseId}`, "core_course_view_course", { courseid: courseId }),

		uploadFiles,

		async getCurrentUser() {
			const info = await this.getSiteInfo();
			return {
				id: info.userId,
				username: info.username,
				fullName: info.fullName,
				profileImageUrl: info.userPictureUrl,
			};
		},

		async getCourses() {
			const info = await this.getSiteInfo();
			const [raw, images] = await Promise.all([
				callMoodle(connection, "core_enrol_get_users_courses", { userid: info.userId }),
				// enrol_get_users_courses often omits banners; the timeline API carries them (and Moodle's generated defaults)
				callMoodle(connection, "core_course_get_enrolled_courses_by_timeline_classification", { classification: "all", limit: 0 })
					.then(normalizeTimelineImages)
					.catch(() => new Map<number, string>()),
			]);
			return normalizeCourses(raw).map((c) => (c.imageUrl ? c : { ...c, imageUrl: images.get(c.id) }));
		},

		async getCompletionDates(courseIds) {
			const info = await fetchSiteInfo();
			const results = await callMany(
				courseIds.map((id) => ({ wsfunction: "core_completion_get_activities_completion_status", params: { courseid: id, userid: info.userId } })),
			);
			return results.flatMap((r, i) => ("data" in r ? normalizeCompletionDates(r.data).map((date) => ({ courseId: courseIds[i], date })) : []));
		},

		async setCourseFavourite(courseId: number, favourite: boolean) {
			await callMoodle(
				connection,
				"core_course_set_favourite_courses",
				{ courses: { 0: { id: courseId, favourite: favourite ? 1 : 0 } } },
				"POST",
			);
		},

		async getCourseContents(courseId: number) {
			const raw = await callMoodle(connection, "core_course_get_contents", {
				courseid: courseId,
			});
			return normalizeCourseContent(courseId, raw);
		},

		async setActivityCompletion(cmid, completed) {
			await callMoodle(
				connection,
				"core_completion_update_activity_completion_status_manually",
				{ cmid, completed: completed ? 1 : 0 },
				"POST",
			);
		},

		async getCourseNavOptions(courseId) {
			try {
				return normalizeNavOptions(await callMoodle(connection, "core_course_get_user_navigation_options", { courseids: { 0: courseId } }));
			} catch {
				return null;
			}
		},

		async getParticipants(courseId) {
			return normalizeParticipants(await callMoodle(connection, "core_enrol_get_enrolled_users", { courseid: courseId }));
		},

		async getCourseCompletion(courseId) {
			try {
				const info = await fetchSiteInfo();
				const raw = await callMoodle(connection, "core_completion_get_course_completion_status", { courseid: courseId, userid: info.userId });
				return normalizeCourseCompletion(raw);
			} catch {
				return null; // tracking disabled for this course
			}
		},

		async selfCompleteCourse(courseId) {
			await callMoodle(connection, "core_completion_mark_course_self_completed", { courseid: courseId }, "POST");
		},

		async getCourseBlocks(courseId) {
			try {
				return normalizeCourseBlocks(await callMoodle(connection, "core_block_get_course_blocks", { courseid: courseId, returncontents: 1 }));
			} catch {
				return [];
			}
		},

		async getUpdatedModules(courseId, sinceSeconds) {
			try {
				return normalizeUpdatedModules(await callMoodle(connection, "core_course_get_updates_since", { courseid: courseId, since: sinceSeconds }));
			} catch {
				return [];
			}
		},

		async getCalendarEvents() {
			const raw = await callMoodle(connection, "core_calendar_get_calendar_upcoming_view");
			return normalizeCalendarEvents(raw);
		},

		async getAssignments(courseIds?: number[]) {
			const raw = await callMoodle(
				connection,
				"mod_assign_get_assignments",
				courseIds ? { courseids: Object.fromEntries(courseIds.map((id, i) => [i, id])) } : {},
			);
			const assignments = normalizeAssignments(raw);
			if (!courseIds) return assignments;
			// A failed status lookup degrades to status "unknown" instead of breaking the whole list.
			const statuses = await callMany(assignments.map((a) => ({ wsfunction: "mod_assign_get_submission_status", params: { assignid: a.id } })));
			return assignments.map((a, i) => ("data" in statuses[i] ? applySubmissionStatus(a, statuses[i].data) : a));
		},

		async getAssignment(assignmentId: number) {
			const raw = await callMoodle(connection, "mod_assign_get_assignments");
			const found = normalizeAssignments(raw).find((a) => a.id === assignmentId);
			if (!found) return undefined;
			const [status] = await callMany([{ wsfunction: "mod_assign_get_submission_status", params: { assignid: found.id } }]);
			const withDetails = "data" in status ? applySubmissionStatus(found, status.data) : found;
			return { ...withDetails, completion: await completionOf(withDetails) };
		},

		async saveAssignmentSubmission(assignment: MoodleAssignment, input: SubmissionInput) {
			const plugindata: MoodleParams = {};
			if (input.text !== undefined) {
				plugindata.onlinetext_editor = { text: input.text, format: 1, itemid: 0 };
			}
			if (input.files) {
				const files = await Promise.all(
					input.files.map(async (f) => {
						if (f instanceof File) return f;
						const res = await fetch(this.fileUrl(f.url, { download: false }));
						if (!res.ok) throw new MoodleError("network_error", `Couldn't read existing file ${f.name} (HTTP ${res.status}).`);
						return new File([await res.blob()], f.name, { type: f.mimeType });
					}),
				);
				plugindata.files_filemanager = files.length
					? await this.uploadFiles(files, { maxBytes: assignment.config?.maxFileBytes, onProgress: input.onProgress })
					: 0;
			}
			await callMoodle(
				connection,
				"mod_assign_save_submission",
				{ assignmentid: assignment.id, plugindata },
				"POST",
			);
		},

		async removeAssignmentSubmission(assignmentId: number) {
			await callMoodle(connection, "mod_assign_remove_submission", { assignmentid: assignmentId }, "POST");
		},

		async getSubmissionComments(assignment: MoodleAssignment) {
			if (assignment.cmid === undefined || !assignment.submission?.id) return [];
			try {
				const raw = await callMoodle(connection, "core_comment_get_comments", {
					...commentTarget(assignment),
					page: 0,
					sortdirection: "ASC",
				});
				return normalizeComments(raw);
			} catch {
				return []; // plugin disabled or not permitted
			}
		},

		async addSubmissionComment(assignment: MoodleAssignment, content: string) {
			await callMoodle(
				connection,
				"core_comment_add_comments",
				{ comments: { 0: { ...commentTarget(assignment), content } } },
				"POST",
			);
		},

		async submitAssignmentForGrading(assignmentId: number) {
			await callMoodle(
				connection,
				"mod_assign_submit_for_grading",
				{ assignmentid: assignmentId, acceptsubmissionstatement: 1 },
				"POST",
			);
		},

		async getGrades(courseId?: number) {
			const info = await this.getSiteInfo();
			const fetchCourse = async (id: number) =>
				normalizeGrades(await callMoodle(connection, "gradereport_user_get_grade_items", { userid: info.userId, courseid: id }));
			if (courseId) return fetchCourse(courseId);
			// courseid is required on many Moodle sites ("Invalid parameter value"), so fetch per course.
			// A course that hides its gradebook fails alone; only throw when every course fails.
			const courses = await this.getCourses();
			const results = await mapLimit(courses, STATUS_CONCURRENCY, (c) =>
				fetchCourse(c.id).then(
					(grades) => ({ grades }),
					(error: unknown) => ({ error }),
				),
			);
			const failed = results.filter((r): r is { error: unknown } => "error" in r);
			if (failed.length && failed.length === results.length) throw failed[0].error;
			return results.flatMap((r) => ("grades" in r ? r.grades : []));
		},

		fileUrl(url: string, opts?: { download?: boolean }) {
			const file = new URL(url, connection.siteUrl);
			// never send the token to a host other than the Moodle site
			if (file.origin !== new URL(connection.siteUrl).origin) return url;
			// the token only works on the webservice/ variant of pluginfile.php
			const path = file.pathname.replace(/(?<!\/webservice)\/pluginfile\.php\//, "/webservice/pluginfile.php/");
			const target = moodleUrl(connection, path);
			file.searchParams.forEach((value, key) => target.searchParams.set(key, value));
			target.searchParams.set("token", connection.token);
			if (opts?.download !== false) target.searchParams.set("forcedownload", "1");
			return target.toString();
		},

		async getNotifications(opts) {
			const info = await this.getSiteInfo();
			const raw = await callMoodle(connection, "message_popup_get_popup_notifications", {
				useridto: info.userId,
				...(opts?.limit ? { limit: opts.limit, offset: opts.offset ?? 0 } : {}),
			});
			return normalizeNotifications(raw);
		},

		async markNotificationRead(notificationId: number) {
			await callMoodle(
				connection,
				"core_message_mark_notification_read",
				{ notificationid: notificationId },
				"POST",
			);
		},

		async markAllNotificationsRead() {
			const info = await this.getSiteInfo();
			await callMoodle(
				connection,
				"core_message_mark_all_notifications_as_read",
				{ useridto: info.userId },
				"POST",
			);
		},
	};
}
