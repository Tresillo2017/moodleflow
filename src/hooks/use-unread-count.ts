"use client";

import { useEffect, useState } from "react";
import { NOTIFICATIONS_CHANGED, useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";

export function useUnreadCount(): number {
	const { client } = useMoodleConnection();
	const [version, setVersion] = useState(0);

	useEffect(() => {
		const bump = () => setVersion((v) => v + 1);
		window.addEventListener(NOTIFICATIONS_CHANGED, bump);
		return () => window.removeEventListener(NOTIFICATIONS_CHANGED, bump);
	}, []);

	const notifications = useMoodleQuery(client ? () => client.getNotifications() : null, [client, version]);
	return notifications.data?.filter((n) => !n.read).length ?? 0;
}
