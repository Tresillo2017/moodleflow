import { useSyncExternalStore } from "react";
import { PENDING_VERSION_KEY } from "@/lib/whats-new";

const CHECKED_KEY = "moodleflow.update-checked";
const RELOAD_DELAY_MS = 900;

export type UpdateStatus = "idle" | "checking" | "current" | "available" | "updating" | "error";

export interface LatestBuild {
	version: string;
	build: string;
}

export interface UpdateState {
	status: UpdateStatus;
	latest: LatestBuild | null;
	/** Epoch ms of the last successful check, kept across reloads. */
	checkedAt: number | null;
}

/** A deploy differs from this tab's build when the build ids (version + commit) don't match. */
export function isUpdateAvailable(running: string | undefined, latest: string | undefined): boolean {
	return Boolean(latest) && latest !== running;
}

function readCheckedAt(): number | null {
	try {
		const raw = Number(window.localStorage.getItem(CHECKED_KEY));
		return Number.isFinite(raw) && raw > 0 ? raw : null;
	} catch {
		return null;
	}
}

const SERVER_STATE: UpdateState = { status: "idle", latest: null, checkedAt: null };
let state: UpdateState = SERVER_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function setState(patch: Partial<UpdateState>) {
	state = { ...state, ...patch };
	listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	if (!hydrated) {
		hydrated = true;
		state = { ...state, checkedAt: readCheckedAt() };
	}
	return () => listeners.delete(listener);
}

export function useUpdateState(): UpdateState {
	return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

/** Asks the server which build is deployed. Resolves to the new status; never throws. */
export async function checkForUpdate(): Promise<UpdateStatus> {
	if (state.status === "checking" || state.status === "updating") return state.status;
	// An update that was already found stays found: the deploy won't un-deploy.
	const wasAvailable = state.status === "available";
	setState({ status: "checking" });
	try {
		const res = await fetch("/api/version", { cache: "no-store" });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const latest = (await res.json()) as Partial<LatestBuild>;
		const checkedAt = Date.now();
		try {
			window.localStorage.setItem(CHECKED_KEY, String(checkedAt));
		} catch {}
		const available = isUpdateAvailable(process.env.NEXT_PUBLIC_BUILD_ID, latest.build);
		const next: UpdateStatus = available || wasAvailable ? "available" : "current";
		setState({
			status: next,
			checkedAt,
			latest: available ? { version: latest.version ?? "", build: latest.build ?? "" } : state.latest,
		});
		return next;
	} catch {
		// offline or mid-deploy: report it and let the next check try again
		setState({ status: wasAvailable ? "available" : "error" });
		return wasAvailable ? "available" : "error";
	}
}

/** Remembers the target version (so the next load shows its notes), then reloads into the new build. */
export function applyUpdate(version: string | undefined = state.latest?.version): void {
	if (state.status === "updating") return;
	setState({ status: "updating" });
	try {
		if (version) window.localStorage.setItem(PENDING_VERSION_KEY, version);
	} catch {}
	setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
}

/** The current state outside React (after a subscriber has hydrated it). */
export const getUpdateState = (): UpdateState => state;
