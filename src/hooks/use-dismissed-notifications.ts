"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "moodleflow.dismissed-notifications";
const MAX = 500;

function load(): number[] {
	try {
		const raw: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
		return Array.isArray(raw) ? raw.filter((id): id is number => Number.isInteger(id)) : [];
	} catch {
		return [];
	}
}

/**
 * Notifications the user cleared. Moodle's web service has no delete for these, so clearing is local
 * to this browser; ids are kept newest-last and capped.
 */
export function useDismissedNotifications() {
	const [ids, setIds] = useState<number[]>([]);
	useEffect(() => setIds(load()), []);

	const dismiss = useCallback((add: number[]) => {
		setIds((prev) => {
			const next = [...new Set([...prev, ...add])].slice(-MAX);
			try {
				window.localStorage.setItem(KEY, JSON.stringify(next));
			} catch {
				// storage blocked: clearing still applies for this session
			}
			return next;
		});
	}, []);

	return { dismissed: ids, dismiss };
}
