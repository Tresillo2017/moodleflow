import { MoodleError } from "@/types/moodle";
import type { H5pActivity, H5pAttempt, LtiLaunch, LtiTool, ScormPackage, ScormSco, ScormScoData, ScormTrack } from "@/types/embed";
import { callMoodle, type MoodleParams } from "./call";
import type { SocialContext } from "./client-social";
import {
	h5pEmbedUrl,
	normalizeH5pActivity,
	normalizeH5pAttempts,
	normalizeLtiLaunch,
	normalizeLtiTool,
	normalizeScorm,
	normalizeScormScoes,
	normalizeScormUserData,
} from "./normalize-embed";
import { asRecord } from "./normalize";

/** Embed activities: H5P, SCORM and LTI (Phase 4). */
export interface EmbedApi {
	getH5pActivity(courseId: number, instance: number): Promise<H5pActivity>;
	/** Asks Moodle to trust/deploy the package, then returns the URL of its H5P player page. */
	getH5pPlayerUrl(activity: H5pActivity): Promise<string>;
	getH5pAttempts(instance: number): Promise<H5pAttempt[]>;
	/** Records xAPI statements against the H5P activity component. */
	postXapiStatements(statements: Record<string, unknown>[]): Promise<void>;

	getScorm(courseId: number, instance: number): Promise<ScormPackage>;
	getScormScoes(scormId: number): Promise<ScormSco[]>;
	getScormAttemptCount(scormId: number): Promise<number>;
	/** Saved data for every SCO of an attempt, keyed by SCO id. */
	getScormUserData(scormId: number, attempt: number): Promise<Record<number, ScormScoData>>;
	/** Logs the SCO launch on the site. Best effort. */
	launchScorm(scormId: number, scoId: number): Promise<void>;
	saveScormTracks(scoId: number, attempt: number, tracks: ScormTrack[]): Promise<void>;

	getLtiTool(courseId: number, instance: number): Promise<LtiTool>;
	/** Fresh signed launch parameters (they expire quickly, so fetch on click). */
	getLtiLaunch(ltiId: number): Promise<LtiLaunch>;
}

const list = (values: number[]): MoodleParams => Object.fromEntries(values.map((v, i) => [i, v]));
const notFound = (what: string) => new MoodleError("unsupported_function", `This ${what} isn't available to you.`);

export function createEmbedApi({ connection, userId }: SocialContext): EmbedApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");

	return {
		async getH5pActivity(courseId, instance) {
			const activity = normalizeH5pActivity(await get("mod_h5pactivity_get_h5pactivities_by_courses", { courseids: list([courseId]) }), instance);
			if (!activity) throw notFound("H5P activity");
			return activity;
		},

		async getH5pPlayerUrl(activity) {
			if (!activity.packageUrl) throw new MoodleError("malformed_response", "This H5P activity has no content file.");
			await post("core_h5p_get_trusted_h5p_file", { url: activity.packageUrl, frame: 1, export: 0, embed: 1, copy: 0 });
			const url = h5pEmbedUrl(connection.siteUrl, activity.packageUrl);
			if (!url) throw new MoodleError("malformed_response", "This H5P content isn't hosted on your Moodle site.");
			return url;
		},

		async getH5pAttempts(instance) {
			return normalizeH5pAttempts(await get("mod_h5pactivity_get_attempts", { h5pactivityid: instance }));
		},

		async postXapiStatements(statements) {
			await post("core_xapi_statement_post", { component: "mod_h5pactivity", requestjson: JSON.stringify(statements) });
		},

		async getScorm(courseId, instance) {
			const pkg = normalizeScorm(await get("mod_scorm_get_scorms_by_courses", { courseids: list([courseId]) }), instance);
			if (!pkg) throw notFound("SCORM package");
			return pkg;
		},

		async getScormScoes(scormId) {
			return normalizeScormScoes(await get("mod_scorm_get_scorm_scoes", { scormid: scormId }));
		},

		async getScormAttemptCount(scormId) {
			return Number(asRecord(await get("mod_scorm_get_scorm_attempt_count", { scormid: scormId, userid: await userId() })).attemptscount ?? 0);
		},

		async getScormUserData(scormId, attempt) {
			return normalizeScormUserData(await get("mod_scorm_get_scorm_user_data", { scormid: scormId, attempt }));
		},

		async launchScorm(scormId, scoId) {
			await post("mod_scorm_launch_sco", { scormid: scormId, scoid: scoId }).catch(() => {});
		},

		async saveScormTracks(scoId, attempt, tracks) {
			if (!tracks.length) return;
			await post("mod_scorm_insert_scorm_tracks", {
				scoid: scoId,
				attempt,
				tracks: Object.fromEntries(tracks.map((t, i) => [i, { element: t.element, value: t.value }])),
			});
		},

		async getLtiTool(courseId, instance) {
			const tool = normalizeLtiTool(await get("mod_lti_get_ltis_by_courses", { courseids: list([courseId]) }), instance);
			if (!tool) throw notFound("external tool");
			return tool;
		},

		async getLtiLaunch(ltiId) {
			return normalizeLtiLaunch(await post("mod_lti_get_tool_launch_data", { toolid: ltiId }));
		},
	};
}
