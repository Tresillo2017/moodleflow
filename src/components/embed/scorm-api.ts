import type { ScormScoData, ScormTrack } from "@/types/embed";

/** Tag on every message a SCO frame posts to the app. */
export const SCORM_SOURCE = "moodleflow-scorm";
/** Message the app posts to a SCO frame to make it send its unsaved values. */
export const SCORM_FLUSH = "moodleflow-flush";

export interface ScormMessage {
	source: typeof SCORM_SOURCE;
	type: "commit" | "finish";
	tracks: ScormTrack[];
}

/**
 * SCORM 1.2 run-time API (LMSInitialize & co.).
 *
 * Its source is serialized into the SCO's sandboxed frame with Function#toString, so it must stay
 * self-contained: no imports, no references outside its own body, no syntax that compiles to helpers.
 * It keeps the data model locally and reports changed elements through `send`; the app persists them.
 */
export function scorm12Runtime(initial: Record<string, string>, send: (message: ScormMessage) => void) {
	const SOURCE = "moodleflow-scorm" as const; // same as SCORM_SOURCE; the frame can't see outer constants
	const VOCAB_STATUS = ["passed", "completed", "failed", "incomplete", "browsed", "not attempted"];
	const VOCAB_EXIT = ["", "time-out", "suspend", "logout"];
	const isScore = (v: string) => v === "" || (/^\d+(\.\d+)?$/.test(v) && Number(v) >= 0 && Number(v) <= 100);
	const isTimespan = (v: string) => /^\d{2,4}:[0-5]\d:[0-5]\d(\.\d{1,2})?$/.test(v);
	const maxLen = (n: number) => (v: string) => v.length <= n;
	const oneOf = (list: string[]) => (v: string) => list.indexOf(v) >= 0;

	// [element pattern, access, validator]; first match wins
	type Rule = [RegExp, "r" | "w" | "rw", ((v: string) => boolean)?];
	const RULES: Rule[] = [
		[/^cmi\.core\.(student_id|student_name|credit|entry|total_time|lesson_mode)$/, "r"],
		[/^cmi\.core\.lesson_location$/, "rw", maxLen(255)],
		[/^cmi\.core\.lesson_status$/, "rw", oneOf(VOCAB_STATUS)],
		[/^cmi\.core\.score\.(raw|min|max)$/, "rw", isScore],
		[/^cmi\.core\.exit$/, "w", oneOf(VOCAB_EXIT)],
		[/^cmi\.core\.session_time$/, "w", isTimespan],
		[/^cmi\.suspend_data$/, "rw", maxLen(4096)],
		[/^cmi\.(launch_data|comments_from_lms|student_data\.(mastery_score|max_time_allowed|time_limit_action))$/, "r"],
		[/^cmi\.comments$/, "rw", maxLen(4096)],
		[/^cmi\.objectives\.\d+\.id$/, "rw", maxLen(255)],
		[/^cmi\.objectives\.\d+\.score\.(raw|min|max)$/, "rw", isScore],
		[/^cmi\.objectives\.\d+\.status$/, "rw", oneOf(VOCAB_STATUS)],
		[/^cmi\.student_preference\.(audio|language|speed|text)$/, "rw"],
		[/^cmi\.interactions\.\d+\.(id|time|type|weighting|student_response|result|latency)$/, "w"],
		[/^cmi\.interactions\.\d+\.objectives\.\d+\.id$/, "w"],
		[/^cmi\.interactions\.\d+\.correct_responses\.\d+\.pattern$/, "w"],
	];
	const CHILDREN: Record<string, string> = {
		"cmi.core._children": "student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time",
		"cmi.core.score._children": "raw,min,max",
		"cmi.objectives._children": "id,score,status",
		"cmi.student_data._children": "mastery_score,max_time_allowed,time_limit_action",
		"cmi.student_preference._children": "audio,language,speed,text",
		"cmi.interactions._children": "id,objectives,time,type,correct_responses,weighting,student_response,result,latency",
		"cmi._version": "3.4",
	};
	const ERRORS: Record<string, string> = {
		"0": "No error",
		"101": "General exception",
		"201": "Invalid argument error",
		"202": "Element cannot have children",
		"203": "Element not an array - cannot have count",
		"301": "Not initialized",
		"401": "Not implemented error",
		"402": "Invalid set value, element is a keyword",
		"403": "Element is read only",
		"404": "Element is write only",
		"405": "Incorrect data type",
	};

	const data: Record<string, string> = {};
	for (const key in initial) if (Object.prototype.hasOwnProperty.call(initial, key)) data[key] = String(initial[key]);
	// a previous session's write-only values aren't readable; `exit` only tells us how to enter
	const suspended = data["cmi.core.exit"] === "suspend";
	delete data["cmi.core.exit"];
	delete data["cmi.core.session_time"];
	if (suspended) data["cmi.core.entry"] = "resume";
	else if (!data["cmi.core.entry"]) data["cmi.core.entry"] = data["cmi.suspend_data"] ? "resume" : "ab-initio";
	if (!data["cmi.core.lesson_status"]) data["cmi.core.lesson_status"] = "not attempted";
	if (!data["cmi.core.total_time"]) data["cmi.core.total_time"] = "0000:00:00";
	if (!data["cmi.core.lesson_mode"]) data["cmi.core.lesson_mode"] = "normal";
	if (!data["cmi.core.credit"]) data["cmi.core.credit"] = "credit";

	let initialized = false;
	let finished = false;
	let errorCode = 0;
	let dirty: Record<string, boolean> = {};

	const ok = () => {
		errorCode = 0;
		return "true";
	};
	const fail = (code: number) => {
		errorCode = code;
		return "false";
	};
	const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
	const ruleFor = (element: string) => RULES.filter((r) => r[0].test(element))[0];

	const toSeconds = (t: string) => {
		const p = t.split(":");
		return Number(p[0]) * 3600 + Number(p[1]) * 60 + Number(p[2]);
	};
	const pad = (n: number, width: number) => ("0000" + n).slice(-width);
	// CMITimespan HHHH:MM:SS.SS
	const addTime = (a: string, b: string) => {
		const centis = Math.round((toSeconds(a) + toSeconds(b)) * 100);
		const secs = Math.floor(centis / 100);
		const fraction = centis % 100;
		return pad(Math.floor(secs / 3600), 4) + ":" + pad(Math.floor((secs % 3600) / 60), 2) + ":" + pad(secs % 60, 2) + (fraction ? "." + pad(fraction, 2).replace(/0$/, "") : "");
	};

	const takeDirty = (): ScormTrack[] => {
		const tracks: ScormTrack[] = [];
		for (const element in dirty) tracks.push({ element, value: data[element] });
		dirty = {};
		return tracks;
	};
	const count = (prefix: string) => {
		let n = 0;
		for (const key in data) {
			const m = key.indexOf(prefix) === 0 && /^\d+/.exec(key.slice(prefix.length));
			if (m) n = Math.max(n, Number(m[0]) + 1);
		}
		return n;
	};

	const api = {
		LMSInitialize(arg: unknown) {
			if (arg !== "" && arg !== undefined) return fail(201);
			if (initialized || finished) return fail(101);
			initialized = true;
			return ok();
		},

		LMSFinish(arg: unknown) {
			if (arg !== "" && arg !== undefined) return fail(201);
			if (!initialized) return fail(301);
			if (dirty["cmi.core.session_time"]) {
				data["cmi.core.total_time"] = addTime(data["cmi.core.total_time"], data["cmi.core.session_time"]);
				dirty["cmi.core.total_time"] = true;
			}
			// a SCO that never reported a status counts as completed, unless it is suspending
			const status = data["cmi.core.lesson_status"];
			if (status === "not attempted" && data["cmi.core.exit"] !== "suspend") {
				data["cmi.core.lesson_status"] = "completed";
				dirty["cmi.core.lesson_status"] = true;
			}
			initialized = false;
			finished = true;
			send({ source: SOURCE, type: "finish", tracks: takeDirty() });
			return ok();
		},

		LMSGetValue(element: unknown) {
			if (!initialized) {
				fail(301);
				return "";
			}
			const key = String(element);
			if (has(CHILDREN, key)) {
				ok();
				return CHILDREN[key];
			}
			if (key === "cmi.objectives._count" || key === "cmi.interactions._count") {
				ok();
				return String(count(key.slice(0, -"_count".length)));
			}
			if (/\._(children|count)$/.test(key)) {
				fail(/_children$/.test(key) ? 202 : 203);
				return "";
			}
			const rule = ruleFor(key);
			if (!rule) {
				fail(/^cmi\./.test(key) ? 401 : 201);
				return "";
			}
			if (rule[1] === "w") {
				fail(404);
				return "";
			}
			ok();
			return data[key] === undefined ? "" : data[key];
		},

		LMSSetValue(element: unknown, value: unknown) {
			if (!initialized) return fail(301);
			const key = String(element);
			if (/\._(children|count)$/.test(key) || key === "cmi._version") return fail(402);
			const rule = ruleFor(key);
			if (!rule) return fail(/^cmi\./.test(key) ? 401 : 201);
			if (rule[1] === "r") return fail(403);
			const text = String(value);
			if (rule[2] && !rule[2](text)) return fail(405);
			data[key] = text;
			dirty[key] = true;
			return ok();
		},

		LMSCommit(arg: unknown) {
			if (arg !== "" && arg !== undefined) return fail(201);
			if (!initialized) return fail(301);
			send({ source: SOURCE, type: "commit", tracks: takeDirty() });
			return ok();
		},

		LMSGetLastError: () => String(errorCode),
		LMSGetErrorString: (code: unknown) => (has(ERRORS, String(code)) ? ERRORS[String(code)] : ""),
		LMSGetDiagnostic: (code: unknown) => {
			const key = code === "" || code === undefined ? String(errorCode) : String(code);
			return has(ERRORS, key) ? ERRORS[key] : "";
		},

		/** Not part of SCORM: sends whatever hasn't been committed (used when the learner leaves). */
		flush() {
			const tracks = takeDirty();
			if (tracks.length) send({ source: SOURCE, type: "commit", tracks });
		},
	};
	return api;
}

/** Script that installs the API as `window.API` in the SCO frame and answers flush requests. */
export function scormShimScript(initial: ScormScoData, appOrigin: string): string {
	// JSON inside a <script>: keep it from closing the tag or breaking on U+2028/9
	const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
	return (
		`(function(){var origin=${json(appOrigin)};` +
		`var api=(${scorm12Runtime.toString()})(${json(initial)},function(m){parent.postMessage(m,origin)});` +
		`window.API=api;` +
		`window.addEventListener("message",function(e){if(e.source===parent&&e.data&&e.data.type===${json(SCORM_FLUSH)}){api.flush()}})})();`
	);
}

const MAX_TRACKS = 500;
const MAX_VALUE = 65_536;

/** Accepts only well-formed tracks from a SCO frame's message; the frame runs untrusted content. */
export function parseScormMessage(data: unknown): ScormMessage | null {
	if (!data || typeof data !== "object") return null;
	const m = data as Record<string, unknown>;
	if (m.source !== SCORM_SOURCE || (m.type !== "commit" && m.type !== "finish") || !Array.isArray(m.tracks)) return null;
	const tracks = m.tracks.slice(0, MAX_TRACKS).flatMap((t): ScormTrack[] => {
		const track = t as Record<string, unknown> | null;
		return typeof track?.element === "string" && /^cmi\.[\w.]{1,200}$/.test(track.element) && typeof track.value === "string" && track.value.length <= MAX_VALUE
			? [{ element: track.element, value: track.value }]
			: [];
	});
	return { source: SCORM_SOURCE, type: m.type, tracks };
}
