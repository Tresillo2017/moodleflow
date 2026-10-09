import { callMoodle, type MoodleParams } from "./call";
import {
	calendarExportUrl,
	createdEventId,
	normalizeAllowedEventTypes,
	normalizeCourseIds,
	normalizeMonthView,
	normalizeRecentItems,
	normalizeTimeline,
	userPreferenceName,
} from "./normalize-calendar";
import { normalizeCourseBlocks } from "./normalize";
import type { SocialContext } from "./client-social";
import type { CalendarEventInput, CalendarEventScope, CourseClassification, RecentItem, TimelineEvent } from "@/types/calendar";
import type { CourseBlock, MoodleCalendarEvent } from "@/types/moodle";

const FORMAT_HTML = 1;
const TIMELINE_PAGE = 50;
const toSeconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** Calendar, timeline, recents and course overview (Phase 6). */
export interface CalendarApi {
	/** Every event in the month (1-12), including course and personal ones. */
	getCalendarMonth(year: number, month: number): Promise<MoodleCalendarEvent[]>;
	/** Event scopes the user may create; empty when the site can't say. */
	getAllowedEventTypes(): Promise<CalendarEventScope[]>;
	createCalendarEvent(input: CalendarEventInput): Promise<number>;
	deleteCalendarEvent(eventId: number): Promise<void>;
	/** Moves an event to another day, keeping its time; `day` is any ISO time on that day. */
	moveCalendarEvent(eventId: number, day: string): Promise<void>;
	/** URL external calendar apps subscribe to, or null when the site has no export. */
	getCalendarExportUrl(): Promise<string | null>;
	/** Action events (assignments due, quizzes closing) between two ISO times, soonest first. */
	getTimeline(from: string, to: string): Promise<TimelineEvent[]>;
	getRecentCourseIds(limit?: number): Promise<number[]>;
	getRecentItems(limit?: number): Promise<RecentItem[]>;
	/** Course ids in Moodle's own overview group (in progress, future, past, starred, hidden). */
	getCourseIdsByClassification(classification: CourseClassification): Promise<number[]>;
	setCourseHidden(courseId: number, hidden: boolean): Promise<void>;
	/** Blocks of the Moodle dashboard that have content and aren't covered by MoodleFlow's own pages. */
	getDashboardBlocks(): Promise<CourseBlock[]>;
	/** Tells Moodle the dashboard was viewed. Best effort. */
	logDashboardView(): Promise<void>;
}

export function createCalendarApi({ connection, userId }: SocialContext): CalendarApi {
	const get = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");

	return {
		async getCalendarMonth(year, month) {
			return normalizeMonthView(await get("core_calendar_get_calendar_monthly_view", { year, month, includenavigation: 0 }));
		},
		async getAllowedEventTypes() {
			return normalizeAllowedEventTypes(await get("core_calendar_get_allowed_event_types"));
		},
		async createCalendarEvent(input) {
			const event: MoodleParams = {
				name: input.name,
				description: input.description ?? "",
				format: FORMAT_HTML,
				eventtype: input.scope,
				timestart: toSeconds(input.start),
				timeduration: (input.durationMinutes ?? 0) * 60,
				repeats: 0,
			};
			if (input.courseId) event.courseid = input.courseId;
			return createdEventId(await post("core_calendar_create_calendar_events", { events: { 0: event } }));
		},
		async deleteCalendarEvent(eventId) {
			await post("core_calendar_delete_calendar_events", { events: { 0: { eventid: eventId, repeat: 0 } } });
		},
		async moveCalendarEvent(eventId, day) {
			await post("core_calendar_update_event_start_day", { eventid: eventId, daytimestamp: toSeconds(day) });
		},
		async getCalendarExportUrl() {
			const raw = await get<{ token?: string }>("core_calendar_get_calendar_export_token");
			return raw.token ? calendarExportUrl(connection.siteUrl, await userId(), raw.token) : null;
		},
		async getTimeline(from, to) {
			const raw = await get("core_calendar_get_action_events_by_timesort", {
				timesortfrom: toSeconds(from),
				timesortto: toSeconds(to),
				limitnum: TIMELINE_PAGE,
			});
			return normalizeTimeline(raw);
		},
		async getRecentCourseIds(limit = 10) {
			return normalizeCourseIds(await get("core_course_get_recent_courses", { userid: await userId(), limit }));
		},
		async getRecentItems(limit = 9) {
			return normalizeRecentItems(await get("block_recentlyaccesseditems_get_recent_items", { limit }));
		},
		async getCourseIdsByClassification(classification) {
			return normalizeCourseIds(await get("core_course_get_enrolled_courses_by_timeline_classification", { classification, limit: 0 }));
		},
		async setCourseHidden(courseId, hidden) {
			const name = userPreferenceName("hidden", courseId);
			const userid = await userId();
			await post("core_user_update_user_preferences", hidden ? { userid, preferences: { 0: { name, value: "true" } } } : { userid, emptypreferences: { 0: { name } } });
		},
		async getDashboardBlocks() {
			return normalizeCourseBlocks(await get("core_block_get_dashboard_blocks", { userid: await userId(), returncontent: 1 }));
		},
		async logDashboardView() {
			await post("core_my_view_page", { page: 0 }).catch(() => undefined);
		},
	};
}
