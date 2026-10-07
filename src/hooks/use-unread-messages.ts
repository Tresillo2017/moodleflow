"use client";

import { useEffect, useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";

/** Fired on window after messages are read or sent, so the tab badges refetch. */
export const MESSAGES_CHANGED = "moodleflow:messages-changed";

const POLL_MS = 60_000;

/** Unread private/group message count, refreshed every minute while the tab is visible. */
export function useUnreadMessages(): number {
	const { client } = useMoodleConnection();
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!client || !client.supports("core_message_get_unread_conversations_count")) return;
		let cancelled = false;
		const load = () => {
			if (document.visibilityState === "visible") client.getUnreadMessageCount().then((n) => !cancelled && setCount(n), () => {});
		};
		load();
		const timer = setInterval(load, POLL_MS);
		window.addEventListener(MESSAGES_CHANGED, load);
		document.addEventListener("visibilitychange", load);
		return () => {
			cancelled = true;
			clearInterval(timer);
			window.removeEventListener(MESSAGES_CHANGED, load);
			document.removeEventListener("visibilitychange", load);
		};
	}, [client]);

	return count;
}
