/** Phase 6: calendar, timeline and dashboard types. */

/** Moodle's event scopes; the site only offers the ones the user may create. */
export type CalendarEventScope = "user" | "course" | "site" | "group" | "category";

export interface CalendarEventInput {
	name: string;
	description?: string;
	/** ISO start time. */
	start: string;
	durationMinutes?: number;
	scope: CalendarEventScope;
	/** Required for course and group events. */
	courseId?: number;
}

/** An actionable item from the timeline (assignment due, quiz closes, ...). */
export interface TimelineEvent {
	id: number;
	name: string;
	courseId?: number;
	courseName?: string;
	/** When the item is due, ISO. */
	date: string;
	/** What to do ("Add submission", "Attempt quiz"), when Moodle names an action. */
	actionLabel?: string;
	actionUrl?: string;
	module?: { name: string; instance: number };
}

/** An activity the user opened recently. */
export interface RecentItem {
	id: number;
	cmid: number;
	courseId: number;
	courseName: string;
	module: string;
	name: string;
	accessedAt: string;
	/** Moodle page for the item; the app resolves it to its own page when it has one. */
	url?: string;
}

/** Moodle's own course overview groups. */
export type CourseClassification = "all" | "inprogress" | "future" | "past" | "favourites" | "hidden";
