export type FileKind =
	| { type: "pdf" }
	| { type: "image" }
	| { type: "code"; lang: string }
	| { type: "other" };

const CODE_LANGS: Record<string, string> = {
	java: "java", sql: "sql", py: "python", js: "javascript", mjs: "javascript", jsx: "jsx", ts: "typescript",
	tsx: "tsx", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cs: "csharp", go: "go", rs: "rust", php: "php",
	rb: "ruby", sh: "bash", bash: "bash", kt: "kotlin", swift: "swift", r: "r", m: "matlab", hs: "haskell",
	json: "json", xml: "xml", html: "html", css: "css", md: "markdown", yml: "yaml", yaml: "yaml",
	txt: "text", csv: "text", log: "text", tex: "latex", ipynb: "json",
};

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

export function fileKind(name: string, mimeType?: string): FileKind {
	const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
	if (ext === "pdf" || mimeType === "application/pdf") return { type: "pdf" };
	if (IMAGE_EXT.has(ext)) return { type: "image" };
	const lang = CODE_LANGS[ext];
	return lang ? { type: "code", lang } : { type: "other" };
}
