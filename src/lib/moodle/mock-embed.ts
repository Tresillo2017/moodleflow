import type { H5pAttempt, ScormScoData, ScormTrack } from "@/types/embed";
import type { EmbedApi } from "./client-embed";

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const wait = <T>(value: T, ms = 200): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));

const DEMO_SCO_PAGE = (title: string) =>
	`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="style.css"></head><body><h1>${title}</h1><p id="state"></p><button id="pass" type="button">Mark as passed (score 90)</button><script src="sco.js"></script></body></html>`;

const DEMO_SCO_SCRIPT = `var api = window.API;
api.LMSInitialize("");
var state = document.getElementById("state");
function show() {
  state.textContent = "Learner: " + api.LMSGetValue("cmi.core.student_name") + " | status: " + api.LMSGetValue("cmi.core.lesson_status") + " | bookmark: " + (api.LMSGetValue("cmi.core.lesson_location") || "none");
}
show();
document.getElementById("pass").onclick = function () {
  api.LMSSetValue("cmi.core.lesson_location", "finished");
  api.LMSSetValue("cmi.core.score.raw", "90");
  api.LMSSetValue("cmi.core.lesson_status", "passed");
  api.LMSSetValue("cmi.core.session_time", "00:00:12");
  api.LMSCommit("");
  show();
};
window.addEventListener("pagehide", function () { api.LMSFinish(""); });`;

const DEMO_SCO_CSS = "body{font-family:system-ui,sans-serif;margin:2rem;color:#222}button{padding:.5rem 1rem;font:inherit;cursor:pointer}";

const scormAttempts = new Map<string, ScormScoData>();
let scormAttemptCount = 0;

let h5pAttempts: H5pAttempt[] = [
	{ id: 1, attempt: 1, time: ago(60 * 24 * 3), score: 3, maxScore: 5, durationSeconds: 95, completed: true, success: false },
];

/** Demo data: one H5P, one SCORM 1.2 package and one LTI tool. */
export function createMockEmbedApi(): EmbedApi {
	return {
		getH5pActivity: (_courseId, instance) =>
			wait({ id: instance, cmid: 9001, name: "Interactive summary", intro: "<p>Pick the statements that summarise the lecture.</p>", trackingEnabled: true, embedUrl: "https://h5p.org/h5p/embed/713" }),
		getH5pPlayerUrl: (activity) => wait(activity.embedUrl ?? "https://h5p.org/h5p/embed/713"),
		getH5pAttempts: () => wait(h5pAttempts),
		postXapiStatements: () => {
			h5pAttempts = [{ id: Date.now(), attempt: h5pAttempts.length + 1, time: ago(0), score: 4, maxScore: 5, durationSeconds: 60, completed: true, success: true }, ...h5pAttempts];
			return wait(undefined, 0);
		},

		getScorm: (_courseId, instance) =>
			wait({
				id: instance,
				cmid: 9002,
				name: "Lab safety basics",
				intro: "<p>A two-part SCORM 1.2 demo. Mark a part as passed and reopen it to see it resume.</p>",
				version: "SCORM_1.2",
				packageUrl: "https://demo.moodleflow.dev/pluginfile.php/1/mod_scorm/package/0/demo.zip",
				maxAttempts: 0,
				demoFiles: { "index.html": DEMO_SCO_PAGE("Part 1: Hazards"), "part2.html": DEMO_SCO_PAGE("Part 2: Procedures"), "sco.js": DEMO_SCO_SCRIPT, "style.css": DEMO_SCO_CSS },
			}),
		getScormScoes: () =>
			wait([
				{ id: 1, identifier: "org", title: "Lab safety basics", depth: 0 },
				{ id: 2, identifier: "sco1", title: "Part 1: Hazards", launch: "index.html", depth: 1 },
				{ id: 3, identifier: "sco2", title: "Part 2: Procedures", launch: "part2.html", depth: 1 },
			]),
		getScormAttemptCount: () => wait(scormAttemptCount),
		getScormUserData: (_scormId, attempt) => {
			const base: ScormScoData = { "cmi.core.student_name": "Costa, Tomas", "cmi.core.student_id": "1" };
			return wait(Object.fromEntries([2, 3].map((id) => [id, { ...base, ...scormAttempts.get(`${attempt}:${id}`) }])));
		},
		launchScorm: () => wait(undefined, 0),
		saveScormTracks: (scoId: number, attempt: number, tracks: ScormTrack[]) => {
			scormAttemptCount = Math.max(scormAttemptCount, attempt);
			const key = `${attempt}:${scoId}`;
			scormAttempts.set(key, { ...scormAttempts.get(key), ...Object.fromEntries(tracks.map((t) => [t.element, t.value])) });
			return wait(undefined, 50);
		},

		getLtiTool: (_courseId, instance) =>
			wait({ id: instance, cmid: 9003, name: "Plagiarism checker", intro: "<p>Opens the external tool in a new tab (the demo posts to a request echo service).</p>", toolUrl: "https://httpbin.org/post" }),
		getLtiLaunch: () =>
			wait({ action: "https://httpbin.org/post", fields: [["lti_message_type", "basic-lti-launch-request"], ["lti_version", "LTI-1p0"], ["resource_link_id", "demo"], ["user_id", "1"], ["roles", "Learner"]] }),
	};
}
