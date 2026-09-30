import type { SocialContext } from "./client-social";
import { callMoodle, type MoodleParams } from "./call";
import { asArray } from "./normalize";
import {
	lessonSubmission,
	normalizeLessonAccess,
	normalizeLessonFinish,
	normalizeLessonGrade,
	normalizeLessonOutline,
	normalizeLessonPage,
	normalizeLessons,
	normalizeLessonResult,
} from "./normalize-lesson";
import type {
	LessonAccess,
	LessonFinish,
	LessonGrade,
	LessonInfo,
	LessonInput,
	LessonOptions,
	LessonOutlineEntry,
	LessonPage,
	LessonPageResult,
} from "@/types/lesson";

/** Lesson activities (Phase 4). */
export interface LessonApi {
	getLessons(courseId: number): Promise<LessonInfo[]>;
	/** Null when the site doesn't expose access information. */
	getLessonAccess(lessonId: number): Promise<LessonAccess | null>;
	getLessonOutline(lessonId: number, options?: LessonOptions): Promise<LessonOutlineEntry[]>;
	/** Starts (or resumes) an attempt; returns Moodle's notices. Throws on a wrong password. */
	launchLesson(lessonId: number, options?: LessonOptions & { pageId?: number }): Promise<string[]>;
	getLessonPage(lessonId: number, pageId: number, options?: LessonOptions): Promise<LessonPage>;
	submitLessonPage(lessonId: number, page: LessonPage, input: LessonInput, options?: LessonOptions): Promise<LessonPageResult>;
	finishLesson(lessonId: number, options?: LessonOptions & { outOfTime?: boolean }): Promise<LessonFinish>;
	getLessonGrade(lessonId: number): Promise<LessonGrade>;
}

export function createLessonApi({ connection, userId }: SocialContext): LessonApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");
	const flag = (v?: boolean) => (v ? 1 : 0);
	const base = (lessonId: number, o: LessonOptions = {}): MoodleParams => ({ lessonid: lessonId, password: o.password ?? "", review: flag(o.review) });

	return {
		async getLessons(courseId) {
			return normalizeLessons(await get("mod_lesson_get_lessons_by_courses", { courseids: { 0: courseId } }));
		},

		async getLessonAccess(lessonId) {
			try {
				return normalizeLessonAccess(await get("mod_lesson_get_lesson_access_information", { lessonid: lessonId }));
			} catch {
				return null;
			}
		},

		async getLessonOutline(lessonId, options) {
			return normalizeLessonOutline(await get("mod_lesson_get_pages", { lessonid: lessonId, password: options?.password ?? "" }));
		},

		async launchLesson(lessonId, options) {
			const raw = await post<{ messages?: unknown }>("mod_lesson_launch_attempt", { ...base(lessonId, options), pageid: options?.pageId ?? 0 });
			return asArray(raw?.messages).map((m) => String((m as { message?: unknown }).message ?? "")).filter(Boolean);
		},

		async getLessonPage(lessonId, pageId, options) {
			return normalizeLessonPage(await get("mod_lesson_get_page_data", { ...base(lessonId, options), pageid: pageId, returncontents: 1 }));
		},

		async submitLessonPage(lessonId, page, input, options) {
			const data = Object.fromEntries(lessonSubmission(page, input).map((d, i) => [i, d]));
			return normalizeLessonResult(await post("mod_lesson_process_page", { ...base(lessonId, options), pageid: page.id, data }));
		},

		async finishLesson(lessonId, options) {
			return normalizeLessonFinish(await post("mod_lesson_finish_attempt", { ...base(lessonId, options), outoftime: flag(options?.outOfTime) }));
		},

		async getLessonGrade(lessonId) {
			return normalizeLessonGrade(await get("mod_lesson_get_user_grade", { lessonid: lessonId, userid: await userId() }));
		},
	};
}
