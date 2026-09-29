import { describe, expect, it } from "vitest";
import { notebookToMarkdown, parseCsv } from "./preview";

describe("parseCsv", () => {
	it("handles quotes, escaped quotes, embedded newlines and CRLF", () => {
		expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n"l1\nl2",z')).toEqual([
			["a", "b"],
			["x, y", 'say "hi"'],
			["l1\nl2", "z"],
		]);
	});
});

describe("notebookToMarkdown", () => {
	it("keeps markdown cells and fences code cells", () => {
		const nb = JSON.stringify({
			metadata: { language_info: { name: "python" } },
			cells: [
				{ cell_type: "markdown", source: ["# Title"] },
				{ cell_type: "code", source: ["print(1)"] },
			],
		});
		expect(notebookToMarkdown(nb)).toBe("# Title\n\n```python\nprint(1)\n```");
	});
});
