import { MoodleError } from "@/types/moodle";
import type {
	ActivityType,
	MoodleAssignment,
	MoodleCalendarEvent,
	MoodleCourse,
	MoodleCourseContent,
	MoodleCourseGrades,
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

// core_course_get_contents
export function normalizeCourseContent(courseId: number, raw: unknown): MoodleCourseContent {
	const sections = asArray(raw).map((s) => {
		const r = asRecord(s);
		const activities = asArray(r.modules).map((m) => {
			const mod = asRecord(m);
			const modname = String(mod.modname ?? "");
			return {
				id: Number(mod.id),
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

// mod_assign_get_assignments
export function normalizeAssignments(raw: unknown): MoodleAssignment[] {
	const r = asRecord(raw);
	const assignments: MoodleAssignment[] = [];
	for (const course of asArray(r.courses)) {
		const c = asRecord(course);
		for (const a of asArray(c.assignments)) {
			const assign = asRecord(a);
			const dueDate = Number(assign.duedate ?? 0);
			assignments.push({
				id: Number(assign.id),
				courseId: Number(c.id),
				courseName: String(c.fullname ?? ""),
				name: String(assign.name ?? ""),
				description: assign.intro ? String(assign.intro) : undefined,
				dueDate: dueDate > 0 ? new Date(dueDate * 1000).toISOString() : undefined,
				status: "not_started",
			});
		}
	}
	return assignments;
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
				percentage:
					item.gradepercentage !== undefined ? Number(item.gradepercentage) : undefined,
				letterGrade: item.gradeletter ? String(item.gradeletter) : undefined,
				feedback: item.feedback ? String(item.feedback) : undefined,
			};
		});
		return {
			courseId: Number(grade.courseid),
			courseName: String(grade.coursename ?? ""),
			items,
		};
	});
}
