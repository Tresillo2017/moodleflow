import type { FileKind } from "./file-kind";

/** Longest file text we put in a prefilled link; longer goes via the clipboard (URLs cap out around 8-16 KB encoded). */
export const MAX_PROMPT_TEXT = 6000;

export type AiAction = "explain" | "summarise" | "quiz" | "review";
export type AiProvider = "claude" | "chatgpt" | "t3" | "gemini";

export const AI_ACTIONS: Record<AiAction, { label: string; ask: string }> = {
	explain: { label: "Explain this", ask: "Explain this file clearly, step by step, as if I'm studying it" },
	summarise: { label: "Summarise", ask: "Summarise the key points of this file" },
	quiz: { label: "Quiz me", ask: "Write 5 practice questions with answers to test my understanding of this file" },
	review: { label: "Review code", ask: "Review this code: find bugs, bad practices and possible improvements" },
};

export const AI_PROVIDERS: Record<AiProvider, { label: string; home: string }> = {
	claude: { label: "Claude", home: "https://claude.ai/new" },
	chatgpt: { label: "ChatGPT", home: "https://chatgpt.com/" },
	t3: { label: "T3 Chat", home: "https://t3.chat/new" },
	gemini: { label: "Gemini", home: "https://gemini.google.com/app" },
};

/** `fits` is false when the text is too long for a link; the caller should copy `text` instead. */
export function aiPrompt(action: AiAction, file: { name: string; text?: string }): { text: string; fits: boolean } {
	const ask = AI_ACTIONS[action].ask;
	if (file.text === undefined) return { text: `${ask}. The file is "${file.name}" (I'll attach it).`, fits: true };
	return { text: `${ask}.\n\nFile: ${file.name}\n\n${file.text}`, fits: file.text.length <= MAX_PROMPT_TEXT };
}

/** Never pass a Moodle file URL in here: it carries the user's token. Gemini has no prefill link. */
export function aiLink(provider: AiProvider, prompt: string): string {
	const { home } = AI_PROVIDERS[provider];
	if (provider === "gemini") return home;
	return `${home}${home.includes("?") ? "&" : "?"}q=${encodeURIComponent(prompt)}`;
}

const shellQuote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

export function claudeCodeCommand(prompt: string, dir?: string): string {
	return `${dir ? `cd ${shellQuote(dir)} && ` : ""}claude ${shellQuote(prompt)}`;
}

interface Ide {
	id: string;
	label: string;
	/** "file" → `scheme://file/<path>`; "open" → `scheme://open?file=<path>` (JetBrains). */
	scheme: string;
	style: "file" | "open";
}

export const IDES: Ide[] = [
	{ id: "vscode", label: "VS Code", scheme: "vscode", style: "file" },
	{ id: "vscode-insiders", label: "VS Code Insiders", scheme: "vscode-insiders", style: "file" },
	{ id: "cursor", label: "Cursor", scheme: "cursor", style: "file" },
	{ id: "windsurf", label: "Windsurf", scheme: "windsurf", style: "file" },
	{ id: "zed", label: "Zed", scheme: "zed", style: "file" },
	{ id: "idea", label: "IntelliJ IDEA", scheme: "idea", style: "open" },
	{ id: "webstorm", label: "WebStorm", scheme: "webstorm", style: "open" },
	{ id: "pycharm", label: "PyCharm", scheme: "pycharm", style: "open" },
];

/** Deep link to a file that was downloaded into `dir`. Accepts unix and windows folders. */
export function ideLink(ide: Ide, dir: string, name: string): string {
	const folder = dir.trim().replaceAll("\\", "/").replace(/\/+$/, "");
	const path = `${folder}/${name}`;
	const absolute = path.startsWith("/") ? path : `/${path}`; // "C:/x" → "/C:/x", what the schemes expect
	if (ide.style === "open") return `${ide.scheme}://open?file=${encodeURIComponent(absolute.replace(/^\/([A-Za-z]:)/, "$1"))}`;
	const encoded = absolute.split("/").map(encodeURIComponent).join("/").replace(/^\/([A-Za-z])%3A/, "/$1:");
	return `${ide.scheme}://file${encoded}`;
}

const TEXTY = new Set<FileKind["type"]>(["code", "markdown", "notebook", "csv"]);

const APPS: Partial<Record<FileKind["type"], string[]>> = {
	pdf: ["Adobe Acrobat", "Okular", "Evince", "Preview"],
	docx: ["Microsoft Word", "LibreOffice Writer", "Pages"],
	image: ["GIMP", "Inkscape", "Preview"],
	audio: ["VLC", "mpv"],
	video: ["VLC", "mpv"],
	csv: ["Microsoft Excel", "LibreOffice Calc", "Numbers"],
};

/** IDEs for text-like files; suggested desktop apps (no link scheme exists for them) for the rest. */
export function appsFor(kind: FileKind): { ides: boolean; apps: string[] } {
	return { ides: TEXTY.has(kind.type), apps: APPS[kind.type] ?? [] };
}
