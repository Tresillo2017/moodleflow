import type { MoodleActivity } from "@/types/moodle";

export type ViewTarget = Pick<MoodleActivity, "type" | "instance">;

/** Activity type -> Moodle's view_* function and the name of its instance-id parameter. */
const VIEW: Partial<Record<MoodleActivity["type"], [string, string]>> = {
	assignment: ["mod_assign_view_assign", "assignid"],
	page: ["mod_page_view_page", "pageid"],
	resource: ["mod_resource_view_resource", "resourceid"],
	url: ["mod_url_view_url", "urlid"],
	forum: ["mod_forum_view_forum", "forumid"],
	folder: ["mod_folder_view_folder", "folderid"],
	quiz: ["mod_quiz_view_quiz", "quizid"],
	lesson: ["mod_lesson_view_lesson", "lessonid"],
	book: ["mod_book_view_book", "bookid"],
	imscp: ["mod_imscp_view_imscp", "imscpid"],
	feedback: ["mod_feedback_view_feedback", "feedbackid"],
};

/** The WS call that records a view of this activity, or null for types Moodle doesn't track (labels, unknown). */
export function viewCall(target: ViewTarget): { wsfunction: string; params: Record<string, number | boolean> } | null {
	const entry = VIEW[target.type];
	if (!entry || target.instance === undefined) return null;
	const [wsfunction, idParam] = entry;
	return { wsfunction, params: { [idParam]: target.instance, ...(target.type === "feedback" && { moduleviewed: true }) } };
}
