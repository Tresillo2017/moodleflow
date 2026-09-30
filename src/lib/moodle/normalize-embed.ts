import { MoodleError } from "@/types/moodle";
import type { H5pActivity, H5pAttempt, LtiLaunch, LtiTool, ScormPackage, ScormSco, ScormScoData } from "@/types/embed";
import { asArray, asRecord } from "./normalize";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const isHttp = (url: string) => /^https?:\/\//i.test(url);

/** Web page of a course module on the Moodle site, used as the "open in Moodle" fallback. */
export const moodleModuleUrl = (siteUrl: string, modname: string, cmid: number) =>
	`${siteUrl.replace(/\/+$/, "")}/mod/${modname}/view.php?id=${cmid}`;

const findById = (rows: unknown[], id: number) => rows.map(asRecord).find((r) => Number(r.id) === id);

// mod_h5pactivity_get_h5pactivities_by_courses
export function normalizeH5pActivity(raw: unknown, instance: number): H5pActivity | null {
	const r = findById(asArray(asRecord(raw).h5pactivities), instance);
	if (!r) return null;
	const pkg = asRecord(asArray(r.package)[0] ?? r.deployedfile ?? {});
	return {
		id: instance,
		cmid: Number(r.coursemodule),
		name: String(r.name ?? "H5P"),
		intro: str(r.intro),
		packageUrl: str(pkg.fileurl),
		trackingEnabled: Boolean(r.enabletracking),
	};
}

/**
 * Moodle's own H5P player page for a package, or null if the package isn't on the Moodle site.
 * embed.php wants the plain pluginfile URL, not the token-only webservice variant.
 */
export function h5pEmbedUrl(siteUrl: string, packageUrl: string): string | null {
	let file: URL;
	try {
		file = new URL(packageUrl, siteUrl);
	} catch {
		return null;
	}
	if (file.origin !== new URL(siteUrl).origin || !/^https?:$/.test(file.protocol)) return null;
	const path = file.pathname.replace("/webservice/pluginfile.php/", "/pluginfile.php/");
	return `${siteUrl.replace(/\/+$/, "")}/h5p/embed.php?url=${encodeURIComponent(file.origin + path)}`;
}

// mod_h5pactivity_get_attempts: one entry per user, each with its attempts
export function normalizeH5pAttempts(raw: unknown): H5pAttempt[] {
	return asArray(asRecord(raw).usersattempts)
		.flatMap((u) => asArray(asRecord(u).attempts))
		.map((a): H5pAttempt => {
			const r = asRecord(a);
			const flag = (v: unknown) => (v === null || v === undefined ? undefined : Boolean(Number(v)));
			return {
				id: Number(r.id),
				attempt: Number(r.attempt ?? 0),
				time: new Date(Number(r.timemodified ?? r.timecreated ?? 0) * 1000).toISOString(),
				score: r.rawscore === null || r.rawscore === undefined ? undefined : Number(r.rawscore),
				maxScore: r.maxscore === null || r.maxscore === undefined ? undefined : Number(r.maxscore),
				durationSeconds: Number(r.duration ?? 0),
				completed: flag(r.completion),
				success: flag(r.success),
			};
		})
		.sort((a, b) => b.attempt - a.attempt);
}

/** An xAPI statement relayed by an embed: needs at least a verb and an object. */
export function isXapiStatement(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== "object") return false;
	const s = value as Record<string, unknown>;
	const verb = s.verb as Record<string, unknown> | undefined;
	return typeof verb?.id === "string" && Boolean(s.object) && typeof s.object === "object";
}

// mod_scorm_get_scorms_by_courses
export function normalizeScorm(raw: unknown, instance: number): ScormPackage | null {
	const r = findById(asArray(asRecord(raw).scorms), instance);
	if (!r) return null;
	return {
		id: instance,
		cmid: Number(r.coursemodule),
		name: String(r.name ?? "SCORM"),
		intro: str(r.intro),
		version: String(r.version ?? ""),
		// only local packages have a downloadable zip
		packageUrl: r.scormtype === undefined || r.scormtype === "local" ? str(r.packageurl) : undefined,
		maxAttempts: Number(r.maxattempt ?? 0),
	};
}

/** Only SCORM 1.2 packages that live on the site can run in the in-app player. */
export const canPlayScorm = (pkg: ScormPackage) => Boolean(pkg.packageUrl) && /1\.2/.test(pkg.version);

// mod_scorm_get_scorm_scoes: flat list; `parent` names the parent's identifier ("/" at the root)
export function normalizeScormScoes(raw: unknown): ScormSco[] {
	const scoes = asArray(asRecord(raw).scoes)
		.map(asRecord)
		.sort((a, b) => Number(a.sortorder ?? 0) - Number(b.sortorder ?? 0));
	const parentOf = new Map(scoes.map((s) => [String(s.identifier), String(s.parent ?? "/")]));
	const depthOf = (identifier: string): number => {
		let depth = 0;
		// bounded so a malformed cycle can't hang the page
		for (let p = parentOf.get(identifier); p && p !== "/" && parentOf.has(p) && depth < 20; p = parentOf.get(p)) depth++;
		return depth;
	};
	return scoes.map((s) => ({
		id: Number(s.id),
		identifier: String(s.identifier ?? ""),
		title: String(s.title ?? "") || "Untitled",
		launch: str(s.launch),
		depth: depthOf(String(s.identifier)),
	}));
}

// mod_scorm_get_scorm_user_data: per SCO, the LMS defaults and the user's saved tracks
export function normalizeScormUserData(raw: unknown): Record<number, ScormScoData> {
	const pairs = (rows: unknown) =>
		Object.fromEntries(asArray(rows).map(asRecord).filter((e) => typeof e.element === "string").map((e) => [String(e.element), String(e.value ?? "")]));
	return Object.fromEntries(
		asArray(asRecord(raw).data).map((d) => {
			const r = asRecord(d);
			return [Number(r.scoid), { ...pairs(r.defaultdata), ...pairs(r.userdata) }];
		}),
	);
}

/** Short status for the SCO list, from its 1.2 lesson status. */
export function scormScoStatus(data: ScormScoData | undefined): string | undefined {
	const status = data?.["cmi.core.lesson_status"];
	return status && status !== "not attempted" ? status : undefined;
}

// mod_lti_get_ltis_by_courses
export function normalizeLtiTool(raw: unknown, instance: number): LtiTool | null {
	const r = findById(asArray(asRecord(raw).ltis), instance);
	if (!r) return null;
	return {
		id: instance,
		cmid: Number(r.coursemodule),
		name: String(r.name ?? "External tool"),
		intro: str(r.intro),
		toolUrl: str(r.securetoolurl) ?? str(r.toolurl),
	};
}

// mod_lti_get_tool_launch_data: endpoint + signed parameters. The endpoint is untrusted, so only http(s) is accepted.
export function normalizeLtiLaunch(raw: unknown): LtiLaunch {
	const r = asRecord(raw);
	const endpoint = String(r.endpoint ?? "");
	let action: string | null = null;
	try {
		const url = new URL(endpoint);
		if (isHttp(url.href)) action = url.href;
	} catch {
		// invalid URL
	}
	if (!action) throw new MoodleError("malformed_response", "Moodle returned an invalid tool address.");
	const fields = asArray(r.parameters)
		.map(asRecord)
		.filter((p) => typeof p.name === "string" && p.name !== "")
		.map((p): [string, string] => [String(p.name), String(p.value ?? "")]);
	return { action, fields };
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Self-submitting page for an LTI launch; every value is escaped, and the only script is the fixed submit call. */
export function ltiFormHtml(launch: LtiLaunch): string {
	const inputs = launch.fields.map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join("");
	return `<!doctype html><meta charset="utf-8"><title>Launching tool…</title><body><form method="post" action="${escapeHtml(launch.action)}">${inputs}<noscript><button type="submit">Continue</button></noscript></form><script>HTMLFormElement.prototype.submit.call(document.forms[0])</script>`;
}
