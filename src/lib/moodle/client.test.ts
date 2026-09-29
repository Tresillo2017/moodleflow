import { describe, expect, it } from "vitest";
import { createMoodleClient } from "./client";

const client = createMoodleClient({ siteUrl: "https://moodle.example.com", token: "SECRET" });

describe("fileUrl", () => {
	it("appends the token for files on the Moodle site", () => {
		const url = client.fileUrl("https://moodle.example.com/webservice/pluginfile.php/1/a.pdf");
		expect(url).toContain("token=SECRET");
	});

	it("never leaks the token to another host", () => {
		const url = "https://evil.example.com/a.pdf";
		expect(client.fileUrl(url)).toBe(url);
	});
});
