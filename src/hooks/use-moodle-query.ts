"use client";

import { useEffect, useState } from "react";
import { MoodleError } from "@/types/moodle";
import { CACHE_UPDATED, SESSION_EXPIRED } from "@/components/providers/moodle-provider";

export interface MoodleQueryState<T> {
	data: T | null;
	error: MoodleError | null;
	loading: boolean;
}

/**
 * Minimal data-fetching hook: no caching layer, just load-once-per-deps-change.
 * ponytail: no react-query dependency for a handful of read-only GETs; add one if
 * cross-page cache sharing or background refetch becomes a real need.
 */
export function useMoodleQuery<T>(
	fetcher: (() => Promise<T>) | null,
	deps: unknown[],
): MoodleQueryState<T> {
	const [state, setState] = useState<MoodleQueryState<T>>({
		data: null,
		error: null,
		loading: Boolean(fetcher),
	});

	// bumped when a background revalidation refreshed the cache; refetching then reads the fresh copy
	const [revalidations, setRevalidations] = useState(0);
	useEffect(() => {
		const onUpdate = () => setRevalidations((n) => n + 1);
		window.addEventListener(CACHE_UPDATED, onUpdate);
		return () => window.removeEventListener(CACHE_UPDATED, onUpdate);
	}, []);

	useEffect(() => {
		if (!fetcher) {
			setState({ data: null, error: null, loading: false });
			return;
		}
		let cancelled = false;
		// On refetch keep showing the previous data instead of flashing a skeleton.
		setState((s) => ({ ...s, loading: s.data === null, error: null }));
		fetcher()
			.then((data) => {
				if (!cancelled) setState({ data, error: null, loading: false });
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				const moodleError =
					error instanceof MoodleError
						? error
						: new MoodleError("unknown_error", "Something went wrong loading this data.");
				if (moodleError.code === "invalid_token") window.dispatchEvent(new Event(SESSION_EXPIRED));
				setState({ data: null, error: moodleError, loading: false });
			});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...deps, revalidations]);

	return state;
}
