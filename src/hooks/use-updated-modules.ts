"use client";

import { useEffect, useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";

const key = (courseId: number) => `moodleflow:course-visit:${courseId}`;

/** Course-module ids Moodle says changed since this browser last opened the course (none on the first visit). */
export function useUpdatedModules(courseId: number): Set<number> {
	const { client } = useMoodleConnection();
	const [updated, setUpdated] = useState<Set<number>>(new Set());

	useEffect(() => {
		if (!client) return;
		let cancelled = false;
		let since = 0;
		try {
			since = Number(localStorage.getItem(key(courseId))) || 0;
		} catch {}
		const done = () => {
			try {
				localStorage.setItem(key(courseId), String(Math.floor(Date.now() / 1000)));
			} catch {}
		};
		if (!since) return done();
		client.getUpdatedModules(courseId, since).then((ids) => {
			if (!cancelled) setUpdated(new Set(ids));
			done();
		});
		return () => {
			cancelled = true;
		};
	}, [client, courseId]);

	return updated;
}
