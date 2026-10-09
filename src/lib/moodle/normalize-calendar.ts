import type { CalendarEventScope, CourseClassification, RecentItem, TimelineEvent } from "@/types/calendar";
import type { MoodleCalendarEvent } from "@/types/moodle";
import { asArray, asRecord, normalizeCalendarEvent } from "./normalize";

/** Like asRecord but optional fields (an absent `action`, an empty warnings list) give {} instead of throwing. */
const optional = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
const seconds = (value: unknown) => new Date(Number(value ?? 0) * 1000).toISOString();

// core_calendar_get_calendar_monthly_view: weeks > days > events; multi-day events repeat on each day
export function normalizeMonthView(raw: unknown): MoodleCalendarEvent[] {
	const seen = new Map<number, MoodleCalendarEvent>();
	for (const week of asArray(asRecord(raw).weeks)) {
		for (const day of asArray(asRecord(week).days)) {
			for (const e of asArray(asRecord(day).events)) {
				const event = normalizeCalendarEvent(e);
				if (!seen.has(event.id)) seen.set(event.id, event);
			}
		}
	}
	return [...seen.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

const SCOPES: CalendarEventScope[] = ["user", "course", "site", "group", "category"];

// core_calendar_get_allowed_event_types: a list of names on current Moodle, a name -> bool map on older ones
export function normalizeAllowedEventTypes(raw: unknown): CalendarEventScope[] {
	const allowed = asRecord(raw).allowedeventtypes;
	const names = Array.isArray(allowed)
		? allowed.map(String)
		: Object.entries(optional(allowed)).filter(([, on]) => on).map(([name]) => name);
	return SCOPES.filter((s) => names.includes(s));
}

// core_calendar_create_calendar_events
export function createdEventId(raw: unknown): number {
	const r = asRecord(raw);
	const warning = optional(asArray(r.warnings)[0]).message;
	const first = optional(asArray(r.events)[0]);
	if (!first.id) throw new Error(typeof warning === "string" && warning ? warning : "Moodle did not create the event.");
	return Number(first.id);
}

// core_calendar_get_action_events_by_timesort
export function normalizeTimeline(raw: unknown): TimelineEvent[] {
	return asArray(asRecord(raw).events).map((e) => {
		const ev = asRecord(e);
		const action = optional(ev.action);
		const course = optional(ev.course);
		return {
			id: Number(ev.id),
			name: String(ev.name ?? ""),
			courseId: course.id ? Number(course.id) : undefined,
			courseName: course.fullname ? String(course.fullname) : undefined,
			date: seconds(ev.timesort),
			actionLabel: action.actionable && action.name ? String(action.name) : undefined,
			actionUrl: typeof action.url === "string" ? action.url : undefined,
			module: ev.modulename && ev.instance ? { name: String(ev.modulename), instance: Number(ev.instance) } : undefined,
		};
	}).sort((a, b) => a.date.localeCompare(b.date));
}

// block_recentlyaccesseditems_get_recent_items
export function normalizeRecentItems(raw: unknown): RecentItem[] {
	return asArray(raw).map((i) => {
		const item = asRecord(i);
		return {
			id: Number(item.id),
			cmid: Number(item.cmid),
			courseId: Number(item.courseid),
			courseName: String(item.coursename ?? ""),
			module: String(item.modname ?? ""),
			name: String(item.name ?? ""),
			accessedAt: seconds(item.timeaccess),
			url: typeof item.viewurl === "string" ? item.viewurl : undefined,
		};
	});
}

// core_course_get_recent_courses (a bare list) and ..._by_timeline_classification ({ courses })
export function normalizeCourseIds(raw: unknown): number[] {
	const list = Array.isArray(raw) ? raw : asRecord(raw).courses;
	return asArray(list).map((c) => Number(asRecord(c).id)).filter(Number.isInteger);
}

export function userPreferenceName(classification: CourseClassification, courseId: number): string {
	return `block_myoverview_${classification}_course_${courseId}`;
}

/** Link external calendar apps subscribe to; Moodle serves it from the user's export token. */
export function calendarExportUrl(siteUrl: string, userId: number, token: string): string {
	const url = new URL("/calendar/export_execute.php", siteUrl);
	url.searchParams.set("userid", String(userId));
	url.searchParams.set("authtoken", token);
	url.searchParams.set("preset_what", "all");
	url.searchParams.set("preset_time", "recentupcoming");
	return url.toString();
}
