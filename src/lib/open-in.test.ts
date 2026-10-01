import { describe, expect, it } from "vitest";
import { aiPrompt, aiLink, claudeCodeCommand, ideLink, IDES, appsFor, MAX_PROMPT_TEXT } from "./open-in";

describe("aiPrompt", () => {
	it("embeds text content and flags nothing when it fits", () => {
		const p = aiPrompt("explain", { name: "a.py", text: "print(1)" });
		expect(p.fits).toBe(true);
		expect(p.text).toContain("a.py");
		expect(p.text).toContain("print(1)");
	});

	it("marks over-long text as not fitting a link but keeps the full text", () => {
		const text = "x".repeat(MAX_PROMPT_TEXT + 1);
		const p = aiPrompt("summarise", { name: "big.txt", text });
		expect(p.fits).toBe(false);
		expect(p.text).toContain(text);
	});

	it("without content asks the user to attach the file", () => {
		const p = aiPrompt("quiz", { name: "slides.pdf" });
		expect(p.fits).toBe(true);
		expect(p.text).toContain("slides.pdf");
		expect(p.text).toMatch(/attach/i);
	});
});

describe("aiLink", () => {
	it("prefills claude, chatgpt and t3 chat with the encoded prompt", () => {
		expect(aiLink("claude", "a b&c")).toBe("https://claude.ai/new?q=a%20b%26c");
		expect(aiLink("chatgpt", "hi")).toBe("https://chatgpt.com/?q=hi");
		expect(aiLink("t3", "hi")).toBe("https://t3.chat/new?q=hi");
	});

	it("opens gemini without a prompt (it has no prefill link)", () => {
		expect(aiLink("gemini", "hi")).toBe("https://gemini.google.com/app");
	});
});

describe("claudeCodeCommand", () => {
	it("single-quotes the prompt safely and cds into the download folder", () => {
		expect(claudeCodeCommand("it's", "/home/me/My Downloads")).toBe(`cd '/home/me/My Downloads' && claude 'it'\\''s'`);
	});

	it("omits the cd when no folder is known", () => {
		expect(claudeCodeCommand("hi")).toBe("claude 'hi'");
	});
});

describe("ideLink", () => {
	const vscode = IDES.find((i) => i.id === "vscode")!;
	it("builds a file deep link, encoding spaces", () => {
		expect(ideLink(vscode, "/home/me/Downloads/", "My File.py")).toBe("vscode://file/home/me/Downloads/My%20File.py");
	});

	it("handles windows folders", () => {
		expect(ideLink(vscode, "C:\\Users\\me\\Downloads", "a.py")).toBe("vscode://file/C:/Users/me/Downloads/a.py");
	});

	it("uses the jetbrains open?file= form", () => {
		const idea = IDES.find((i) => i.id === "idea")!;
		expect(ideLink(idea, "/d", "a.java")).toBe("idea://open?file=%2Fd%2Fa.java");
	});
});

describe("appsFor", () => {
	it("offers IDEs for code and plain editors-friendly types, apps for the rest", () => {
		expect(appsFor({ type: "code", lang: "java" }).ides).toBe(true);
		expect(appsFor({ type: "pdf" })).toEqual({ ides: false, apps: expect.arrayContaining(["Adobe Acrobat"]) });
		expect(appsFor({ type: "other" })).toEqual({ ides: false, apps: [] });
	});
});
