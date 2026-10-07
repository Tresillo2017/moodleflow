import { useEffect, useSyncExternalStore } from "react";

let pending = 0;
const listeners = new Set<() => void>();

function bump(delta: number) {
	pending = Math.max(0, pending + delta);
	listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

/** Queries report loading; the shell's top bar runs while any of them is loading. */
export function useLoaderBar(active: boolean): void {
	useEffect(() => {
		if (!active) return;
		bump(1);
		return () => bump(-1);
	}, [active]);
}

export function useLoaderActive(): boolean {
	return useSyncExternalStore(subscribe, () => pending > 0, () => false);
}

