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

	it("falls back to other for unknown or extensionless files", () => {
		expect(fileKind("slides.pptx")).toEqual({ type: "other" });
		expect(fileKind("Makefile")).toEqual({ type: "other" });
	});
});
