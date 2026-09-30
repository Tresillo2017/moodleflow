// Embedded activities: H5P, SCORM, LTI (Phase 4).

export interface H5pActivity {
	/** Module instance id. */
	id: number;
	cmid: number;
	name: string;
	intro?: string;
	/** The .h5p package file; the player URL is derived from it. */
	packageUrl?: string;
	trackingEnabled: boolean;
	/** Ready-made player URL (demo mode); real sites derive it from `packageUrl`. */
	embedUrl?: string;
}

export interface H5pAttempt {
	id: number;
	attempt: number;
	time: string;
	score?: number;
	maxScore?: number;
	durationSeconds: number;
	completed?: boolean;
	success?: boolean;
}

export interface ScormPackage {
	/** Module instance id. */
	id: number;
	cmid: number;
	name: string;
	intro?: string;
	/** Moodle's version string, e.g. "SCORM_1.2", "SCORM_1.3", "AICC". */
	version: string;
	/** Local package zip; external/AICC packages have none. */
	packageUrl?: string;
	/** 0 means unlimited. */
	maxAttempts: number;
	/** Demo mode: package files inline, in place of a download. */
	demoFiles?: Record<string, string>;
}

export interface ScormSco {
	id: number;
	identifier: string;
	title: string;
	/** Launch path inside the package; empty for organisation headings. */
	launch?: string;
	/** Indentation level in the table of contents. */
	depth: number;
}

/** Element -> value, defaults overlaid with the user's saved tracks. */
export type ScormScoData = Record<string, string>;

export interface ScormTrack {
	element: string;
	value: string;
}

export interface LtiTool {
	/** Module instance id. */
	id: number;
	cmid: number;
	name: string;
	intro?: string;
	toolUrl?: string;
}

/** A validated LTI launch: an http(s) endpoint and the fields to POST to it. */
export interface LtiLaunch {
	action: string;
	fields: [name: string, value: string][];
}
