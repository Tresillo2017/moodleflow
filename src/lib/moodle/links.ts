/** Where a Moodle URL (from a notification, say) should lead inside MoodleFlow. */
export type MoodleLink =
	| { kind: "discussion"; discussionId: number }
	| { kind: "module"; cmid: number }
	| { kind: "course"; courseId: number }
	| { kind: "messages" };

/** Parses a URL on the Moodle site into an in-app target; null for other hosts or pages we don't have. */
export function parseMoodleLink(url: string, siteUrl: string): MoodleLink | null {
	let target: URL;
	let site: URL;
	try {
		target = new URL(url, siteUrl);
		site = new URL(siteUrl);
	} catch {
		return null;
	}
	if (target.origin !== site.origin) return null;
	const num = (name: string) => {
		const n = Number(target.searchParams.get(name));
		return Number.isInteger(n) && n > 0 ? n : null;
	};
	const path = target.pathname.replace(/^.*?(?=\/(mod|course|message)\/)/, "");
	if (path === "/mod/forum/discuss.php") {
		const d = num("d");
		return d ? { kind: "discussion", discussionId: d } : null;
	}
	if (/^\/mod\/[a-z_]+\/view\.php$/.test(path)) {
		const id = num("id");
		return id ? { kind: "module", cmid: id } : null;
	}
	if (path === "/course/view.php") {
		const id = num("id");
		return id ? { kind: "course", courseId: id } : null;
	}
	if (path.startsWith("/message/")) return { kind: "messages" };
	return null;
}

/** In-app path for a module of this type, or null when we only have the course page. */
export function modulePath(modname: string, instance: number, courseId: number): string {
	switch (modname) {
		case "assign":
			return `/assignments/${instance}`;
		case "forum":
			return `/forums/${instance}?course=${courseId}`;
		case "chat":
			return `/chat/${instance}?course=${courseId}`;
		case "bigbluebuttonbn":
			return `/meetings/${instance}?course=${courseId}`;
		case "quiz":
			return `/quizzes/${instance}?course=${courseId}`;
		case "lesson":
			return `/lessons/${instance}?course=${courseId}`;
		case "workshop":
			return `/workshops/${instance}?course=${courseId}`;
		case "choice":
			return `/choices/${instance}?course=${courseId}`;
		case "feedback":
			return `/feedback/${instance}?course=${courseId}`;
		case "survey":
			return `/surveys/${instance}?course=${courseId}`;
		case "h5pactivity":
			return `/h5p/${instance}?course=${courseId}`;
		case "scorm":
			return `/scorm/${instance}?course=${courseId}`;
		case "lti":
			return `/lti/${instance}?course=${courseId}`;
		default:
			return `/courses/${courseId}`;
	}
}
