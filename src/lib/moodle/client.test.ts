import { afterEach, describe, expect, it, vi } from "vitest";
import { createMoodleClient } from "./client";

const client = createMoodleClient({ siteUrl: "https://moodle.example.com", token: "SECRET" });
const proxied = createMoodleClient({ siteUrl: "https://moodle.example.com", token: "SECRET", proxy: true });

afterEach(() => vi.unstubAllGlobals());

describe("fileUrl", () => {
	it("appends the token for files on the Moodle site", () => {
		const url = client.fileUrl("https://moodle.example.com/webservice/pluginfile.php/1/a.pdf");
		expect(url).toContain("token=SECRET");
	});

	it.each([
		"https://evil.example.com/a.pdf",
		"https://moodle.example.com.evil.com/webservice/pluginfile.php/1/a.pdf",
		"//evil.example.com/a.pdf",
		"https://user@evil.example.com/a.pdf",
	])("never leaks the token to another host: %s", (url) => {
		for (const c of [client, proxied]) {
			expect(c.fileUrl(url)).not.toContain("SECRET");
		}
	});

	it("routes through the proxy without losing the query or the site", () => {
		const url = new URL(proxied.fileUrl("https://moodle.example.com/webservice/pluginfile.php/1/a.pdf?rev=2"));
		expect(url.pathname).toBe("/api/moodle/webservice/pluginfile.php/1/a.pdf");
		expect(url.searchParams.get("moodle_site")).toBe("https://moodle.example.com");
		expect(url.searchParams.get("rev")).toBe("2");
	});
});

describe("capabilities", () => {
	const info = { sitename: "S", userid: 1, functions: [{ name: "core_course_get_contents" }] };
	const stubSite = () => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(info))));

	it("is optimistic until site info loads, then reflects the site's function list", async () => {
		stubSite();
		const c = createMoodleClient({ siteUrl: "https://moodle.example.com", token: "T" });
		expect(c.supports("mod_assign_get_assignments")).toBe(true);
		await c.getSiteInfo();
		expect(c.supports("core_course_get_contents")).toBe(true);
		expect(c.supports("mod_assign_get_assignments")).toBe(false);
	});

	it("skips view logging for functions the site doesn't offer", async () => {
		stubSite();
		const c = createMoodleClient({ siteUrl: "https://moodle.example.com", token: "T" });
		expect(await c.logActivityView({ type: "page", instance: 3 })).toBe(false);
	});
});
