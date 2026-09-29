"use client";

import { useRouter } from "next/navigation";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { parseMoodleLink } from "@/lib/moodle/links";
import { isHttpUrl } from "@/lib/utils";

/**
 * Opens a Moodle URL inside MoodleFlow when we have a page for it (discussions, assignments, forums,
 * chats, meetings, courses, messages); anything else opens in Moodle in a new tab.
 */
export function useMoodleLinkOpener(): (url: string) => Promise<void> {
	const router = useRouter();
	const { client, connection } = useMoodleConnection();

	return async (url) => {
		const link = connection && parseMoodleLink(url, connection.siteUrl);
		let path: string | null = null;
		if (link?.kind === "discussion") path = `/discussions/${link.discussionId}`;
		else if (link?.kind === "course") path = `/courses/${link.courseId}`;
		else if (link?.kind === "messages") path = "/messages";
		else if (link?.kind === "module") path = (await client?.resolveModuleRoute(link.cmid)) ?? null;
		if (path) router.push(path);
		else if (isHttpUrl(url)) window.open(url, "_blank", "noopener,noreferrer");
	};
}
