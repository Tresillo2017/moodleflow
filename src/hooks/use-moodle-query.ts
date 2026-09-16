"use client";

import { useEffect, useState } from "react";
import { MoodleError } from "@/types/moodle";

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

	useEffect(() => {
		if (!fetcher) {
			setState({ data: null, error: null, loading: false });
			return;
		}
		let cancelled = false;
		setState((s) => ({ ...s, loading: true, error: null }));
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
				setState({ data: null, error: moodleError, loading: false });
			});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);

	return state;
}
