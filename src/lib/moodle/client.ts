import { MoodleError } from "@/types/moodle";
import type {
	MoodleAssignment,
	MoodleCalendarEvent,
	MoodleCourse,
	MoodleCourseContent,
	MoodleCourseGrades,
	MoodleSiteInfo,
	MoodleUser,
} from "@/types/moodle";
import {
	normalizeAssignments,
	normalizeCalendarEvents,
	normalizeCourseContent,
	normalizeCourses,
	normalizeGrades,
	normalizeSiteInfo,
} from "./normalize";

export interface MoodleClient {
	getSiteInfo(): Promise<MoodleSiteInfo>;
	getCurrentUser(): Promise<MoodleUser>;
	getCourses(): Promise<MoodleCourse[]>;
	getCourseContents(courseId: number): Promise<MoodleCourseContent>;
	getCalendarEvents(): Promise<MoodleCalendarEvent[]>;
	getAssignments(): Promise<MoodleAssignment[]>;
	getGrades(courseId?: number): Promise<MoodleCourseGrades[]>;
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
async function callMoodle<T>(
	connection: MoodleConnection,
	wsfunction: string,
	params: Record<string, string | number> = {},
): Promise<T> {
	const url = new URL("/webservice/rest/server.php", connection.siteUrl);
	url.searchParams.set("wstoken", connection.token);
	url.searchParams.set("wsfunction", wsfunction);
	url.searchParams.set("moodlewsrestformat", "json");
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, String(value));
	}

	let response: Response;
	try {
		response = await fetch(url.toString(), { method: "GET" });
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

export function createMoodleClient(connection: MoodleConnection): MoodleClient {
	return {
		async getSiteInfo() {
			const raw = await callMoodle(connection, "core_webservice_get_site_info");
			return normalizeSiteInfo(raw);
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

		async getAssignments() {
			const raw = await callMoodle(connection, "mod_assign_get_assignments");
			return normalizeAssignments(raw);
		},

		async getGrades(courseId?: number) {
			const info = await this.getSiteInfo();
			const raw = await callMoodle(connection, "gradereport_user_get_grade_items", {
				userid: info.userId,
				...(courseId ? { courseid: courseId } : {}),
			});
			return normalizeGrades(raw);
		},
	};
}
