import { describe, expect, it } from "vitest";
import {
	canPlayScorm,
	h5pEmbedUrl,
	isXapiStatement,
	ltiFormHtml,
	moodleModuleUrl,
	normalizeH5pActivity,
	normalizeH5pAttempts,
	normalizeLtiLaunch,
	normalizeLtiTool,
	normalizeScorm,
	normalizeScormScoes,
	normalizeScormUserData,
	scormScoStatus,
} from "./normalize-embed";

describe("H5P", () => {
	it("finds the activity and its package file", () => {
		const raw = { h5pactivities: [{ id: 1, coursemodule: 10, name: "Other" }, { id: 2, coursemodule: 11, name: "Quiz", intro: "<p>hi</p>", enabletracking: 1, package: [{ fileurl: "https://m.example/webservice/pluginfile.php/5/mod_h5pactivity/package/0/a.h5p" }] }] };
		expect(normalizeH5pActivity(raw, 2)).toMatchObject({ id: 2, cmid: 11, name: "Quiz", trackingEnabled: true, packageUrl: expect.stringContaining("a.h5p") });
		expect(normalizeH5pActivity(raw, 9)).toBeNull();
		expect(normalizeH5pActivity({}, 1)).toBeNull();
	});

	it("builds the site's player URL from the plain pluginfile URL", () => {
		const url = h5pEmbedUrl("https://m.example/", "https://m.example/webservice/pluginfile.php/5/mod_h5pactivity/package/0/a.h5p?token=secret");
		expect(url).toBe(`https://m.example/h5p/embed.php?url=${encodeURIComponent("https://m.example/pluginfile.php/5/mod_h5pactivity/package/0/a.h5p")}`);
		expect(url).not.toContain("secret");
	});

	it("refuses packages hosted elsewhere", () => {
		expect(h5pEmbedUrl("https://m.example", "https://evil.example/pluginfile.php/1/a.h5p")).toBeNull();
		expect(h5pEmbedUrl("https://m.example", "javascript:alert(1)")).toBeNull();
	});

	it("flattens attempts newest first", () => {
		const attempts = normalizeH5pAttempts({ usersattempts: [{ userid: 1, attempts: [{ id: 1, attempt: 1, rawscore: 3, maxscore: 5, duration: 60, completion: 1, success: 0, timemodified: 100 }, { id: 2, attempt: 2, rawscore: null, maxscore: null, completion: null, success: null }] }] });
		expect(attempts.map((a) => a.attempt)).toEqual([2, 1]);
		expect(attempts[1]).toMatchObject({ score: 3, maxScore: 5, durationSeconds: 60, completed: true, success: false });
		expect(attempts[0]).toMatchObject({ score: undefined, completed: undefined });
	});

	it("recognises xAPI statements", () => {
		expect(isXapiStatement({ verb: { id: "http://adlnet.gov/expapi/verbs/answered" }, object: { id: "x" } })).toBe(true);
		expect(isXapiStatement({ verb: {}, object: {} })).toBe(false);
		expect(isXapiStatement("nope")).toBe(false);
	});

	it("links to the module page", () => {
		expect(moodleModuleUrl("https://m.example/", "h5pactivity", 7)).toBe("https://m.example/mod/h5pactivity/view.php?id=7");
	});
});

describe("SCORM", () => {
	const scorms = { scorms: [{ id: 3, coursemodule: 30, name: "Safety", version: "SCORM_1.2", scormtype: "local", packageurl: "https://m.example/webservice/pluginfile.php/1/mod_scorm/package/0/s.zip", maxattempt: 2 }, { id: 4, coursemodule: 31, name: "New", version: "SCORM_1.3", packageurl: "https://m.example/x.zip" }] };

	it("reads the package and decides whether it can play", () => {
		const pkg = normalizeScorm(scorms, 3)!;
		expect(pkg).toMatchObject({ cmid: 30, maxAttempts: 2, version: "SCORM_1.2" });
		expect(canPlayScorm(pkg)).toBe(true);
		expect(canPlayScorm(normalizeScorm(scorms, 4)!)).toBe(false);
		expect(canPlayScorm({ ...pkg, packageUrl: undefined })).toBe(false);
		expect(canPlayScorm({ ...pkg, version: "AICC" })).toBe(false);
		expect(normalizeScorm({ scorms: [{ id: 5, coursemodule: 1, version: "SCORM_1.2", scormtype: "external", packageurl: "https://x/y" }] }, 5)?.packageUrl).toBeUndefined();
		expect(normalizeScorm(scorms, 99)).toBeNull();
	});

	it("nests the table of contents by parent identifier", () => {
		const scoes = normalizeScormScoes({ scoes: [
			{ id: 3, identifier: "sco_a", parent: "mod1", title: "A", launch: "a.html", sortorder: 3 },
			{ id: 1, identifier: "org", parent: "/", title: "Course", launch: "", sortorder: 1 },
			{ id: 2, identifier: "mod1", parent: "org", title: "Module", sortorder: 2 },
		] });
		expect(scoes.map((s) => [s.id, s.depth, s.launch])).toEqual([[1, 0, undefined], [2, 1, undefined], [3, 2, "a.html"]]);
	});

	it("survives a cyclic parent chain", () => {
		const scoes = normalizeScormScoes({ scoes: [{ id: 1, identifier: "a", parent: "b" }, { id: 2, identifier: "b", parent: "a" }] });
		expect(scoes[0].depth).toBeLessThanOrEqual(20);
	});

	it("overlays saved tracks on the LMS defaults", () => {
		const data = normalizeScormUserData({ data: [{ scoid: 3, defaultdata: [{ element: "cmi.core.student_name", value: "Ana" }, { element: "cmi.core.lesson_status", value: "not attempted" }], userdata: [{ element: "cmi.core.lesson_status", value: "completed" }] }] });
		expect(data[3]).toEqual({ "cmi.core.student_name": "Ana", "cmi.core.lesson_status": "completed" });
		expect(scormScoStatus(data[3])).toBe("completed");
		expect(scormScoStatus({ "cmi.core.lesson_status": "not attempted" })).toBeUndefined();
		expect(scormScoStatus(undefined)).toBeUndefined();
	});
});

describe("LTI", () => {
	it("reads the tool, preferring the secure URL", () => {
		expect(normalizeLtiTool({ ltis: [{ id: 8, coursemodule: 80, name: "Turnitin", toolurl: "http://t.example/", securetoolurl: "https://t.example/" }] }, 8)).toMatchObject({ cmid: 80, toolUrl: "https://t.example/" });
		expect(normalizeLtiTool({ ltis: [] }, 8)).toBeNull();
	});

	it("builds a launch from the endpoint and parameters", () => {
		const launch = normalizeLtiLaunch({ endpoint: "https://tool.example/launch?a=1", parameters: [{ name: "oauth_nonce", value: "abc" }, { name: "n", value: 5 }, { name: "", value: "skip" }, { value: "no name" }] });
		expect(launch).toEqual({ action: "https://tool.example/launch?a=1", fields: [["oauth_nonce", "abc"], ["n", "5"]] });
	});

	it("only accepts http(s) endpoints", () => {
		for (const endpoint of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "not a url", "", undefined]) {
			expect(() => normalizeLtiLaunch({ endpoint, parameters: [] })).toThrow();
		}
		expect(() => normalizeLtiLaunch(null)).toThrow();
	});

	it("escapes every value in the launch form", () => {
		const html = ltiFormHtml({ action: 'https://tool.example/a?x="1"&y=<2>', fields: [['na"me', '"><script>alert(1)</script>'], ["ok", "a & b's"]] });
		expect(html).toContain('action="https://tool.example/a?x=&quot;1&quot;&amp;y=&lt;2&gt;"');
		expect(html).toContain('name="na&quot;me" value="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
		expect(html).toContain('value="a &amp; b&#39;s"');
		expect(html.match(/<script>/g)).toHaveLength(1);
		expect(html).toContain('method="post"');
	});
});
