import type { MoodleNotification } from "@/types/moodle";

const KNOWN: Record<string, string> = {
	mod_forum: "Forums",
	mod_assign: "Assignments",
	mod_quiz: "Quizzes",
	mod_chat: "Chat",
	mod_bigbluebuttonbn: "Meetings",
	mod_feedback: "Feedback",
	mod_lesson: "Lessons",
};

/** Human label for the kind of thing a notification is about, for the type filter. */
export function notificationType(n: Pick<MoodleNotification, "component" | "eventType">): string {
	if (n.eventType === "instantmessage") return "Messages";
	if (n.component && KNOWN[n.component]) return KNOWN[n.component];
	const name = n.component?.replace(/^(mod_|core_)/, "");
	if (!name || name === "moodle") return "Other";
	return name.charAt(0).toUpperCase() + name.slice(1);
}
