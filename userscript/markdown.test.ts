// bun test markdown.test.ts — htmlToMarkdown needs a DOM, so happy-dom is registered globally for these tests.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";

const BASE = "https://moodle.example/mod/assign/view.php?id=1";
beforeAll(() => GlobalRegistrator.register({ url: BASE }));
afterAll(() => GlobalRegistrator.unregister());

const md = async (html: string, image: (img: HTMLImageElement) => string | null = () => null): Promise<string> => {
	const { htmlToMarkdown } = await import("./src/savetext");
	const root = document.createElement("div");
	root.innerHTML = html;
	return htmlToMarkdown(root, image, BASE);
};

test("inline code and a link with parentheses in the URL", async () => {
	expect(await md('<p>Use <code>time_slice</code> and <a href="https://example.com/a_(b)">this</a></p>')).toBe("Use `time_slice` and [this](https://example.com/a_%28b%29)");
});
test("nested ordered and unordered lists", async () => {
	expect(await md("<ol><li>Read<ul><li>file</li></ul></li><li>Print</li></ol>")).toBe("1. Read\n   - file\n2. Print");
});
test("table with a pipe in a cell", async () => {
	expect(await md("<table><tr><th>Process</th><th>Burst | ms</th></tr><tr><td>P1</td><td>5</td></tr></table>")).toBe("| Process | Burst \\| ms |\n| --- | --- |\n| P1 | 5 |");
});
test("headings", async () => {
	expect(await md("<h3>Goal</h3>")).toBe("### Goal");
});
test("bold, italic and code", async () => {
	expect(await md("<p><strong>a</strong> <em>b</em> <code>c</code></p>")).toBe("**a** *b* `c`");
});
test("relative link resolves against the base", async () => {
	expect(await md('<p><a href="/course/view.php?id=2">Course</a></p>')).toBe("[Course](https://moodle.example/course/view.php?id=2)");
});
test("pre block is fenced", async () => {
	expect(await md("<pre>a  b\nc</pre>")).toBe("```\na  b\nc\n```");
});
test("blockquote", async () => {
	expect(await md("<blockquote><p>quoted</p></blockquote>")).toBe("> quoted");
});
test("image callback supplies a local path", async () => {
	expect(await md('<p><img src="/a.png" alt="Diagram"></p>', () => "images/image-1.png")).toBe("![Diagram](images/image-1.png)");
});
test("image callback returning null drops the image", async () => {
	expect(await md('<p>x<img src="/a.png" alt="Diagram"></p>')).toBe("x");
});
test("script and button content is dropped", async () => {
	expect(await md("<p>keep</p><script>alert(1)</script><button>Click</button>")).toBe("keep");
});
test("snake_case keeps underscores while a lone asterisk is escaped", async () => {
	expect(await md("<p>use snake_case and 2 * 3</p>")).toBe("use snake_case and 2 \\* 3");
});
test("empty link and empty bold produce no output", async () => {
	expect(await md('<p><a href="https://x.y"></a><strong></strong></p>')).toBe("");
});
