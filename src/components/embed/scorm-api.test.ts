import { describe, expect, it } from "vitest";
import { parseScormMessage, scorm12Runtime, scormShimScript, type ScormMessage } from "./scorm-api";

function setup(initial: Record<string, string> = {}) {
	const sent: ScormMessage[] = [];
	const api = scorm12Runtime(initial, (m) => sent.push(m));
	return { api, sent };
}

describe("SCORM 1.2 runtime", () => {
	it("requires initialization before data access", () => {
		const { api } = setup();
		expect(api.LMSGetValue("cmi.core.lesson_status")).toBe("");
		expect(api.LMSGetLastError()).toBe("301");
		expect(api.LMSSetValue("cmi.core.lesson_status", "passed")).toBe("false");
		expect(api.LMSInitialize("")).toBe("true");
		expect(api.LMSInitialize("")).toBe("false");
		expect(api.LMSGetLastError()).toBe("101");
		expect(api.LMSInitialize("x")).toBe("false");
	});

	it("serves defaults and resume data", () => {
		const { api } = setup({ "cmi.core.student_name": "Costa, Ana", "cmi.suspend_data": "abc", "cmi.core.lesson_location": "p3" });
		api.LMSInitialize("");
		expect(api.LMSGetValue("cmi.core.student_name")).toBe("Costa, Ana");
		expect(api.LMSGetValue("cmi.core.entry")).toBe("resume");
		expect(api.LMSGetValue("cmi.core.lesson_location")).toBe("p3");
		expect(api.LMSGetValue("cmi.core.lesson_status")).toBe("not attempted");
		expect(api.LMSGetValue("cmi.core.total_time")).toBe("0000:00:00");
		expect(api.LMSGetValue("cmi.core._children")).toContain("lesson_status");
		expect(api.LMSGetLastError()).toBe("0");
	});

	it("enters ab initio on a fresh attempt and resumes after a suspend exit", () => {
		const fresh = setup();
		fresh.api.LMSInitialize("");
		expect(fresh.api.LMSGetValue("cmi.core.entry")).toBe("ab-initio");
		const suspended = setup({ "cmi.core.exit": "suspend", "cmi.core.entry": "ab-initio" });
		suspended.api.LMSInitialize("");
		expect(suspended.api.LMSGetValue("cmi.core.entry")).toBe("resume");
		expect(suspended.api.LMSGetValue("cmi.core.exit")).toBe("");
		expect(suspended.api.LMSGetLastError()).toBe("404");
	});

	it("enforces access and data types", () => {
		const { api } = setup();
		api.LMSInitialize("");
		expect(api.LMSSetValue("cmi.core.student_id", "1")).toBe("false");
		expect(api.LMSGetLastError()).toBe("403");
		expect(api.LMSSetValue("cmi.core._children", "x")).toBe("false");
		expect(api.LMSGetLastError()).toBe("402");
		expect(api.LMSSetValue("cmi.core.lesson_status", "great")).toBe("false");
		expect(api.LMSGetLastError()).toBe("405");
		expect(api.LMSSetValue("cmi.core.score.raw", "120")).toBe("false");
		expect(api.LMSGetLastError()).toBe("405");
		expect(api.LMSSetValue("cmi.core.session_time", "1:2:3")).toBe("false");
		expect(api.LMSSetValue("cmi.bogus", "1")).toBe("false");
		expect(api.LMSGetLastError()).toBe("401");
		expect(api.LMSGetValue("cmi.interactions.0.id")).toBe("");
		expect(api.LMSGetLastError()).toBe("404");
		expect(api.LMSGetErrorString("403")).toBe("Element is read only");
		expect(api.LMSGetErrorString("constructor")).toBe("");
	});

	it("counts array entries", () => {
		const { api } = setup();
		api.LMSInitialize("");
		expect(api.LMSGetValue("cmi.objectives._count")).toBe("0");
		api.LMSSetValue("cmi.objectives.0.id", "o1");
		api.LMSSetValue("cmi.objectives.1.id", "o2");
		expect(api.LMSGetValue("cmi.objectives._count")).toBe("2");
		expect(api.LMSGetValue("cmi.objectives.1.id")).toBe("o2");
	});

	it("commits only what changed", () => {
		const { api, sent } = setup({ "cmi.core.lesson_location": "p1" });
		api.LMSInitialize("");
		api.LMSSetValue("cmi.core.lesson_location", "p2");
		api.LMSSetValue("cmi.core.score.raw", "80");
		expect(api.LMSCommit("")).toBe("true");
		expect(sent).toEqual([{ source: "moodleflow-scorm", type: "commit", tracks: [{ element: "cmi.core.lesson_location", value: "p2" }, { element: "cmi.core.score.raw", value: "80" }] }]);
		api.LMSCommit("");
		expect(sent[1].tracks).toEqual([]);
	});

	it("adds session time to total time and completes on finish", () => {
		const { api, sent } = setup({ "cmi.core.total_time": "0000:10:30.50" });
		api.LMSInitialize("");
		api.LMSSetValue("cmi.core.session_time", "0000:00:45.75");
		expect(api.LMSFinish("")).toBe("true");
		const tracks = Object.fromEntries(sent[0].tracks.map((t) => [t.element, t.value]));
		expect(sent[0].type).toBe("finish");
		expect(tracks["cmi.core.total_time"]).toBe("0000:11:16.25");
		expect(tracks["cmi.core.lesson_status"]).toBe("completed");
		expect(api.LMSGetValue("cmi.core.lesson_status")).toBe("");
		expect(api.LMSGetLastError()).toBe("301");
	});

	it("keeps the reported status and doesn't complete a suspended SCO", () => {
		const passed = setup();
		passed.api.LMSInitialize("");
		passed.api.LMSSetValue("cmi.core.lesson_status", "passed");
		passed.api.LMSFinish("");
		expect(passed.sent[0].tracks).toEqual([{ element: "cmi.core.lesson_status", value: "passed" }]);

		const suspended = setup();
		suspended.api.LMSInitialize("");
		suspended.api.LMSSetValue("cmi.core.exit", "suspend");
		suspended.api.LMSFinish("");
		expect(suspended.sent[0].tracks.map((t) => t.element)).toEqual(["cmi.core.exit"]);
	});

	it("flushes unsaved values on request", () => {
		const { api, sent } = setup();
		api.LMSInitialize("");
		api.flush();
		expect(sent).toHaveLength(0);
		api.LMSSetValue("cmi.suspend_data", "state");
		api.flush();
		expect(sent[0].tracks).toEqual([{ element: "cmi.suspend_data", value: "state" }]);
	});
});

describe("shim script", () => {
	it("installs window.API and posts to the app origin", () => {
		const posted: [unknown, string][] = [];
		const listeners: Record<string, (e: unknown) => void> = {};
		const parent = { postMessage: (m: unknown, origin: string) => posted.push([m, origin]) };
		const win: { API?: ReturnType<typeof scorm12Runtime> } & Record<string, unknown> = { addEventListener: (t: string, fn: (e: unknown) => void) => (listeners[t] = fn) };
		new Function("window", "parent", scormShimScript({ "cmi.core.student_name": "</script>" }, "https://app.example"))(win, parent);
		const api = win.API!;
		api.LMSInitialize("");
		expect(api.LMSGetValue("cmi.core.student_name")).toBe("</script>");
		api.LMSSetValue("cmi.core.lesson_location", "x");
		api.LMSCommit("");
		expect(posted[0][1]).toBe("https://app.example");
		listeners.message({ source: {}, data: { type: "moodleflow-flush" } });
		api.LMSSetValue("cmi.core.lesson_location", "y");
		listeners.message({ source: parent, data: { type: "moodleflow-flush" } });
		expect(posted).toHaveLength(2);
	});

	it("can't be closed early by data containing </script>", () => {
		expect(scormShimScript({ a: "</script><script>alert(1)</script>" }, "https://x")).not.toContain("</script>");
	});
});

describe("parseScormMessage", () => {
	it("keeps only well-formed cmi tracks", () => {
		const m = parseScormMessage({
			source: "moodleflow-scorm",
			type: "commit",
			tracks: [{ element: "cmi.core.lesson_status", value: "passed" }, { element: "evil", value: "1" }, { element: "cmi.x", value: 5 }, null, { element: "cmi.suspend_data", value: "ok" }],
		});
		expect(m?.tracks.map((t) => t.element)).toEqual(["cmi.core.lesson_status", "cmi.suspend_data"]);
	});

	it("rejects foreign or malformed messages", () => {
		expect(parseScormMessage(null)).toBeNull();
		expect(parseScormMessage({ source: "other", type: "commit", tracks: [] })).toBeNull();
		expect(parseScormMessage({ source: "moodleflow-scorm", type: "boom", tracks: [] })).toBeNull();
		expect(parseScormMessage({ source: "moodleflow-scorm", type: "commit", tracks: "x" })).toBeNull();
	});
});
