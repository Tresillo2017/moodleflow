export type FileKind =
	| { type: "pdf" }
	| { type: "image" }
	| { type: "docx" }
	| { type: "markdown" }
	| { type: "csv" }
	| { type: "notebook" }
	| { type: "audio" }
	| { type: "video" }
	| { type: "code"; lang: string }
	| { type: "other" };

const CODE_LANGS: Record<string, string> = {
	java: "java", sql: "sql", py: "python", js: "javascript", mjs: "javascript", jsx: "jsx", ts: "typescript",
	tsx: "tsx", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cs: "csharp", go: "go", rs: "rust", php: "php",
	rb: "ruby", sh: "bash", bash: "bash", kt: "kotlin", swift: "swift", r: "r", m: "matlab", hs: "haskell",
	json: "json", xml: "xml", html: "html", css: "css", yml: "yaml", yaml: "yaml",
	txt: "text", log: "text", tex: "latex",
};

const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a", "flac"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v"]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

export function fileKind(name: string, mimeType?: string): FileKind {
	const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
	if (ext === "pdf" || mimeType === "application/pdf") return { type: "pdf" };
	if (IMAGE_EXT.has(ext)) return { type: "image" };
	if (ext === "docx") return { type: "docx" }; // legacy .doc/.odt/.rtf stay download-only
	if (ext === "md" || ext === "markdown") return { type: "markdown" };
	if (ext === "csv") return { type: "csv" };
	if (ext === "ipynb") return { type: "notebook" };
	if (AUDIO_EXT.has(ext)) return { type: "audio" };
	if (VIDEO_EXT.has(ext)) return { type: "video" };
	const lang = CODE_LANGS[ext];
	return lang ? { type: "code", lang } : { type: "other" };
}
