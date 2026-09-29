import type { ChangelogRelease } from "./changelog";

/** localStorage key holding the version the user chose to update to; the next load shows its notes. */
export const PENDING_VERSION_KEY = "moodleflow.pending-update";

/** Notes to show after a reload: only when the pending update is now the running version. */
export function notesToShow(pending: string | null, running: string, release: ChangelogRelease | null): ChangelogRelease | null {
	return pending && pending === running && release?.version === running ? release : null;
}
