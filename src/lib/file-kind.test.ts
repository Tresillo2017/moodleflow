import { describe, expect, it } from "vitest";
import { fileKind } from "./file-kind";

describe("fileKind", () => {
	it("detects pdf by extension or mime type", () => {
		expect(fileKind("Notes.PDF")).toEqual({ type: "pdf" });
		expect(fileKind("download", "application/pdf")).toEqual({ type: "pdf" });
	});

	it("maps code extensions to shiki languages", () => {
		expect(fileKind("Main.java")).toEqual({ type: "code", lang: "java" });
		expect(fileKind("q.sql")).toEqual({ type: "code", lang: "sql" });
		expect(fileKind("a.b.py")).toEqual({ type: "code", lang: "python" });
	});

	it("detects rich previews", () => {
		expect(fileKind("a.docx")).toEqual({ type: "docx" });
		expect(fileKind("README.md")).toEqual({ type: "markdown" });
		expect(fileKind("d.csv")).toEqual({ type: "csv" });
		expect(fileKind("n.ipynb")).toEqual({ type: "notebook" });
		expect(fileKind("s.mp3")).toEqual({ type: "audio" });
		expect(fileKind("v.MP4")).toEqual({ type: "video" });
		expect(fileKind("old.doc")).toEqual({ type: "other" });
	});

	it("falls back to other for unknown or extensionless files", () => {
		expect(fileKind("slides.pptx")).toEqual({ type: "other" });
		expect(fileKind("Makefile")).toEqual({ type: "other" });
	});
});
