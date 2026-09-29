import type { ChangelogRelease } from "./changelog";

/** Every release from CHANGELOG.md, inlined at build time by next.config.ts. */
export const releases: ChangelogRelease[] = JSON.parse(process.env.NEXT_PUBLIC_RELEASES ?? "[]");
