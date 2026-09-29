import { MoodleError } from "@/types/moodle";
import { uploadDraftFiles } from "./upload";
import type {
	MoodleAssignment,
	MoodleCalendarEvent,
	MoodleCourse,
	MoodleCourseContent,
	MoodleCourseGrades,
	MoodleFile,
	MoodleForumDiscussion,
	MoodleNotification,
	MoodleSiteInfo,
	MoodleUser,
} from "@/types/moodle";
import {
	applySubmissionStatus,
	normalizeAssignments,
	normalizeCalendarEvents,
	normalizeCourseContent,
	normalizeCourses,
	normalizeForumDiscussions,
	normalizeGrades,
	normalizeNotifications,
	normalizeSiteInfo,
} from "./normalize";

export interface MoodleClient {
	getSiteInfo(): Promise<MoodleSiteInfo>;
	getCurrentUser(): Promise<MoodleUser>;
	getCourses(): Promise<MoodleCourse[]>;
	setCourseFavourite(courseId: number, favourite: boolean): Promise<void>;
	getCourseContents(courseId: number): Promise<MoodleCourseContent>;
	getCalendarEvents(): Promise<MoodleCalendarEvent[]>;
	/** With courseIds, also fetches each assignment's real submission status; without, status is "unknown". */
	getAssignments(courseIds?: number[]): Promise<MoodleAssignment[]>;
	getAssignment(assignmentId: number): Promise<MoodleAssignment | undefined>;
	/** Saves text and/or files (existing MoodleFile entries are re-uploaded so they survive the save). */
	saveAssignmentSubmission(assignment: MoodleAssignment, input: SubmissionInput): Promise<void>;
	submitAssignmentForGrading(assignmentId: number): Promise<void>;
	getGrades(courseId?: number): Promise<MoodleCourseGrades[]>;
	getForumDiscussions(forumId: number): Promise<MoodleForumDiscussion[]>;
	/** Adds the auth token to a Moodle file URL so the browser can download it. */
	fileUrl(url: string, opts?: { download?: boolean }): string;
	getNotifications(): Promise<MoodleNotification[]>;
	markNotificationRead(notificationId: number): Promise<void>;
	markAllNotificationsRead(): Promise<void>;
}

export interface SubmissionInput {
	text?: string;
	files?: (File | MoodleFile)[];
}

export interface MoodleConnection {
	siteUrl: string;
	token: string;
}

/**
 * Calls Moodle's REST web service endpoint directly from the browser.
 * Requires the Moodle site to allow cross-origin requests from this app's
 * origin (Site administration > Server > HTTP > "Allowed CORS origins"),
 * since there is no server-side proxy in this architecture.
 */
type MoodleParamValue = string | number | boolean | MoodleParams;
type MoodleParams = { [key: string]: MoodleParamValue };

/** Flattens nested params into Moodle's REST bracket notation, e.g. {a: {b: 1}} -> "a[b]=1". */
function flattenParams(params: MoodleParams, prefix = ""): [string, string][] {
	const entries: [string, string][] = [];
	for (const [key, value] of Object.entries(params)) {
		const name = prefix ? `${prefix}[${key}]` : key;
		if (value && typeof value === "object") {
			entries.push(...flattenParams(value, name));
		} else {
			entries.push([name, String(value)]);
		}
	}
	return entries;
}

async function callMoodle<T>(
	connection: MoodleConnection,
	wsfunction: string,
	params: MoodleParams = {},
	method: "GET" | "POST" = "GET",
): Promise<T> {
	const url = new URL("/webservice/rest/server.php", connection.siteUrl);
	url.searchParams.set("wstoken", connection.token);
	url.searchParams.set("wsfunction", wsfunction);
	url.searchParams.set("moodlewsrestformat", "json");

	let response: Response;
	try {
		if (method === "GET") {
			for (const [key, value] of flattenParams(params)) {
				url.searchParams.set(key, value);
			}
			response = await fetch(url.toString(), { method: "GET" });
		} else {
			const body = new URLSearchParams(flattenParams(params));
			response = await fetch(url.toString(), {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body,
			});
		}
	} catch {
		throw new MoodleError(
			"network_error",
			"Couldn't reach the Moodle server. Check the site URL and your connection.",
		);
	}

	if (!response.ok) {
		throw new MoodleError(
			"site_unavailable",
			`Moodle responded with status ${response.status}.`,
		);
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new MoodleError(
			"malformed_response",
			"Moodle returned a response that couldn't be parsed.",
		);
	}

	if (data && typeof data === "object" && "exception" in data) {
		const err = data as { errorcode?: string; message?: string };
		if (err.errorcode === "invalidtoken") {
			throw new MoodleError("invalid_token", "This Moodle token is invalid or has expired.");
		}
		throw new MoodleError(
			"unknown_error",
			err.message ?? "Moodle rejected this request.",
		);
	}

	return data as T;
}

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

	/** A failed status lookup degrades to status "unknown" instead of breaking the whole list. */
	async function withStatus(assignment: MoodleAssignment): Promise<MoodleAssignment> {
		try {
			const raw = await callMoodle(connection, "mod_assign_get_submission_status", { assignid: assignment.id });
			return applySubmissionStatus(assignment, raw);
		} catch {
			return assignment;
		}
	}

	return {
		getSiteInfo() {
			siteInfo ??= callMoodle(connection, "core_webservice_get_site_info")
				.then(normalizeSiteInfo)
				.catch((error: unknown) => {
					siteInfo = null;
					throw error;
				});
			return siteInfo;
		},

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
			const raw = await callMoodle(connection, "core_enrol_get_users_courses", {
				userid: info.userId,
			});
			return normalizeCourses(raw);
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
			return mapLimit(assignments, STATUS_CONCURRENCY, (a) => withStatus(a));
		},

		async getAssignment(assignmentId: number) {
			const raw = await callMoodle(connection, "mod_assign_get_assignments");
			const found = normalizeAssignments(raw).find((a) => a.id === assignmentId);
			return found && withStatus(found);
		},

		async saveAssignmentSubmission(assignment: MoodleAssignment, input: SubmissionInput) {
			const plugindata: MoodleParams = {};
			if (input.text !== undefined) {
				plugindata.onlinetext_editor = { text: input.text, format: 2, itemid: 0 };
			}
			if (input.files) {
				const files = await Promise.all(
					input.files.map(async (f) => {
						if (f instanceof File) return f;
						const res = await fetch(this.fileUrl(f.url, { download: false }));
						if (!res.ok) throw new MoodleError("network_error", `Couldn't read existing file ${f.name}.`);
						return new File([await res.blob()], f.name, { type: f.mimeType });
					}),
				);
				plugindata.files_filemanager = files.length ? await uploadDraftFiles(connection, files) : 0;
			}
			await callMoodle(
				connection,
				"mod_assign_save_submission",
				{ assignmentid: assignment.id, plugindata },
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
			const raw = await callMoodle(connection, "gradereport_user_get_grade_items", {
				userid: info.userId,
				...(courseId ? { courseid: courseId } : {}),
			});
			return normalizeGrades(raw);
		},

		async getForumDiscussions(forumId: number) {
			const raw = await callMoodle(connection, "mod_forum_get_forum_discussions", {
				forumid: forumId,
			});
			return normalizeForumDiscussions(raw);
		},

		fileUrl(url: string, opts?: { download?: boolean }) {
			const file = new URL(url, connection.siteUrl);
			// never send the token to a host other than the Moodle site
			if (file.origin !== new URL(connection.siteUrl).origin) return url;
			file.searchParams.set("token", connection.token);
			if (opts?.download !== false) file.searchParams.set("forcedownload", "1");
			return file.toString();
		},

		async getNotifications() {
			const info = await this.getSiteInfo();
			const raw = await callMoodle(connection, "message_popup_get_popup_notifications", {
				useridto: info.userId,
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
