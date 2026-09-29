// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeMoodleHtml } from "./sanitize";

const fileUrl = (url: string) => (url.startsWith("https://moodle.example.com/") ? `${url}?token=SECRET` : url);

describe("sanitizeMoodleHtml", () => {
	it.each([
		["<script>alert(1)</script><p>hi</p>", "<script"],
		['<img src=x onerror="alert(1)">', "onerror"],
		['<a href="javascript:alert(1)">x</a>', "javascript:"],
		['<iframe src="https://evil.example.com"></iframe>', "<iframe"],
		['<svg onload="alert(1)"></svg>', "onload"],
		['<form action="https://evil.example.com"><input></form>', "evil.example.com"],
		['<p style="background:url(https://evil.example.com/x)">x</p>', "evil.example.com"],
	])("neutralises %s", (html, forbidden) => {
		expect(sanitizeMoodleHtml(html)).not.toContain(forbidden);
	});

	it("opens links in a new tab with noopener", () => {
		const out = sanitizeMoodleHtml('<a href="https://example.com">x</a>');
		expect(out).toContain('target="_blank"');
		expect(out).toContain("noopener");
	});

	it("adds the token to Moodle file URLs, on images, video and audio sources", () => {
		const html =
			'<img src="https://moodle.example.com/pluginfile.php/1/a.png"><video controls><source src="https://moodle.example.com/pluginfile.php/1/v.mp4"></video><audio controls src="https://moodle.example.com/pluginfile.php/1/a.mp3"></audio>';
		const out = sanitizeMoodleHtml(html, { fileUrl });
		expect(out.match(/token=SECRET/g)).toHaveLength(3);
		expect(out).toContain("/webservice/pluginfile.php/1/a.png");
		expect(out).toContain("<video");
	});

	it("never adds the token to other hosts", () => {
		const out = sanitizeMoodleHtml('<img src="https://cdn.example.com/pluginfile.php/1/a.png">', { fileUrl });
		expect(out).not.toContain("SECRET");
	});

	it("resolves @@PLUGINFILE@@ against the given base", () => {
		const out = sanitizeMoodleHtml('<img src="@@PLUGINFILE@@/pic.png">', {
			fileUrl,
			pluginfileBase: "https://moodle.example.com/pluginfile.php/5/mod_page/content/0",
		});
		expect(out).toContain("/webservice/pluginfile.php/5/mod_page/content/0/pic.png?token=SECRET");
	});

	it("drops pasted colours so the theme controls contrast", () => {
		const out = sanitizeMoodleHtml('<p style="color:#000;font-weight:bold">x</p><font color="red">y</font>');
		expect(out).not.toContain("color");
		expect(out).toContain("font-weight");
	});
});
