import { describe, expect, it } from "vitest";
import { isProxiedPath, parseProxyTarget } from "./proxy";

describe("parseProxyTarget", () => {
	it("accepts a public https site and returns its origin", () => {
		expect(parseProxyTarget("https://moodle.example.com/some/path")).toBe("https://moodle.example.com");
	});

	it.each([
		"http://moodle.example.com",
		"https://localhost",
		"https://127.0.0.1",
		"https://10.0.0.5",
		"https://[::1]",
		"https://intranet",
		"https://moodle.internal",
		"https://user:pw@moodle.example.com",
		"https://moodle.example.com:8443",
		"not a url",
		"",
	])("refuses %s", (site) => {
		expect(parseProxyTarget(site)).toBeNull();
	});

	it("refuses a missing site", () => {
		expect(parseProxyTarget(null)).toBeNull();
	});
});

describe("isProxiedPath", () => {
	it("only allows web service endpoints", () => {
		expect(isProxiedPath("webservice/rest/server.php")).toBe(true);
		expect(isProxiedPath("webservice/pluginfile.php/1/mod_resource/content/0/a.pdf")).toBe(true);
		expect(isProxiedPath("admin/index.php")).toBe(false);
		expect(isProxiedPath("webservice/rest/server.php/../../admin")).toBe(false);
	});
});
