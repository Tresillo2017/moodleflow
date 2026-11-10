// "Save as Markdown" on an assignment page: the description becomes a .md file; when it contains pictures they are
// fetched (your session cookie goes with the request) and everything is saved as a .zip with an images/ folder.
import * as settings from "./settings";
import * as m from "./moodle";
import { onDomChange } from "./watch";
import { zip, type ZipEntry } from "./zipwrite";
import { h } from "./dom";

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "BUTTON", "FORM", "SELECT", "TEXTAREA", "INPUT"]);
const MIME_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif", "image/bmp": "bmp" };
const MIN_ICON_PX = 24, RESET_MS = 2500;

/** Pure: "Lab 3: Process Scheduling" → "lab-3-process-scheduling" (accents dropped, at most 60 characters). */
export const slug = (title: string): string => title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "assignment";
/** Pure: file extension for a fetched image, from its content type, else from its URL. */
export const imageExt = (type: string, url: string): string => MIME_EXT[type.split(";")[0].trim().toLowerCase()] ?? /\.([a-z0-9]{2,4})(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ?? "img";

type Ctx = { image: (img: HTMLImageElement) => string | null; pre: boolean; base: string };

const wrap = (mark: string, inner: string): string => (inner.trim() ? `${inner.startsWith(" ") ? " " : ""}${mark}${inner.trim()}${mark}${inner.endsWith(" ") ? " " : ""}` : inner);
const escapeText = (s: string): string => s.replace(/([\\`*[\]])/g, "\\$1").replace(/(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])/g, "\\_");
const cell = (el: Element, c: Ctx): string => [...el.childNodes].map((k) => walk(k, c)).join("").replace(/\s*\n+\s*/g, " ").replace(/\|/g, "\\|").trim();

function list(el: Element, c: Ctx): string {
	const ordered = el.tagName === "OL";
	let n = Number(el.getAttribute("start")) || 1;
	const items = [...el.children].filter((k) => k.tagName === "LI").map((li) => {
		const text = [...li.childNodes].map((k) => walk(k, c)).join("").trim().replace(/\n{2,}/g, "\n");
		const mark = ordered ? `${n++}. ` : "- ";
		return mark + text.split("\n").map((line, i) => (i ? " ".repeat(mark.length) + line : line)).join("\n");
	});
	return `\n\n${items.join("\n")}\n\n`;
}

function table(el: Element, c: Ctx): string {
	const rows = [...el.querySelectorAll("tr")].map((tr) => [...tr.children].filter((k) => k.tagName === "TH" || k.tagName === "TD").map((k) => cell(k, c)));
	const width = Math.max(0, ...rows.map((r) => r.length));
	if (!rows.length || !width) return "";
	const pad = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? "").join(" | ")} |`;
	return `\n\n${pad(rows[0])}\n| ${Array(width).fill("---").join(" | ")} |\n${rows.slice(1).map(pad).join("\n")}\n\n`;
}

function walk(n: Node, c: Ctx): string {
	if (n.nodeType === Node.TEXT_NODE) { const t = n.textContent ?? ""; return c.pre ? t : escapeText(t.replace(/\s+/g, " ")); }
	if (!(n instanceof Element) || SKIP.has(n.tagName) || n.hasAttribute("hidden") || n.hasAttribute("data-mf-ui") || n.classList.contains("sr-only")) return "";
	const kids = (ctx: Ctx = c) => [...n.childNodes].map((k) => walk(k, ctx)).join("");
	const tag = n.tagName;
	if (/^H[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${kids().replace(/\s+/g, " ").trim()}\n\n`;
	switch (tag) {
		case "BR": return "  \n";
		case "HR": return "\n\n---\n\n";
		case "STRONG": case "B": return wrap("**", kids());
		case "EM": case "I": return wrap("*", kids());
		case "DEL": case "S": return wrap("~~", kids());
		case "CODE": return c.pre ? kids() : (n.textContent?.trim() ? `\`${n.textContent.trim().replace(/`/g, "'")}\`` : "");
		case "PRE": return `\n\n\`\`\`\n${(n.textContent ?? "").replace(/\n+$/, "")}\n\`\`\`\n\n`;
		case "UL": case "OL": return list(n, c);
		case "BLOCKQUOTE": return `\n\n${kids().trim().split("\n").map((l) => `> ${l}`.trimEnd()).join("\n")}\n\n`;
		case "TABLE": return table(n, c);
		case "IMG": { const src = c.image(n as HTMLImageElement); return src ? `![${(n.getAttribute("alt") ?? "").replace(/[\[\]\n]/g, " ").trim()}](${src})` : ""; }
		case "VIDEO": case "AUDIO": case "IFRAME": { const src = n.getAttribute("src") || n.querySelector("source")?.getAttribute("src"); return src ? `\n\n[${tag === "IFRAME" ? "Embedded content" : tag === "VIDEO" ? "Video" : "Audio"}](${new URL(src, c.base).href})\n\n` : ""; }
		case "A": {
			const href = n.getAttribute("href") ?? "", text = kids().trim();
			if (!text) return "";
			if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return text;
			return `[${text}](${new URL(href, c.base).href.replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
		}
		case "P": case "DIV": case "SECTION": case "ARTICLE": case "FIGURE": case "FIGCAPTION": case "TR": case "DL": case "DT": case "DD": return `\n\n${kids().trim()}\n\n`;
		default: return kids();
	}
}

/** The description's DOM as Markdown. `image` decides each picture's target (a local path, or null to drop it). */
export function htmlToMarkdown(root: Element, image: (img: HTMLImageElement) => string | null, base: string = location.href): string {
	return [...root.childNodes].map((k) => walk(k, { image, pre: false, base })).join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const isPicture = (img: HTMLImageElement): boolean => !img.classList.contains("icon") && !img.classList.contains("emoji") && !img.closest("[data-mf-ui]")
	&& !!(img.currentSrc || img.src) && ((img.complete && !img.naturalWidth) || (img.naturalWidth || img.width || MIN_ICON_PX) >= MIN_ICON_PX); // a picture that failed to load still counts: its address is kept
const srcOf = (img: HTMLImageElement): string => new URL(img.currentSrc || img.src, location.href).href;

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
	try {
		const res = await fetch(url, { credentials: "include" });
		if (!res.ok) return null;
		return { bytes: new Uint8Array(await res.arrayBuffer()), ext: imageExt(res.headers.get("content-type") ?? "", url) };
	} catch { return null; }
}

/** What the page says about the assignment above the text: course, the dates box, and where it came from. */
function header(title: string): string {
	const dates = [...document.querySelectorAll('[data-region="activity-dates"] > div')].map((d) => d.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean);
	const course = m.pageLabel();
	const lines = [course ? `- Course: ${course}` : "", ...dates.map((d) => `- ${d}`), `- Source: ${location.origin}${location.pathname}${location.search}`].filter(Boolean);
	return `# ${title}\n\n${lines.join("\n")}\n\n---\n\n`;
}

function download(name: string, data: BlobPart, type: string): void {
	const url = URL.createObjectURL(new Blob([data], { type }));
	const a = h("a", { href: url, download: name, "data-mf-ui": "" });
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Saves one description. Returns what was written, for the button's message. */
export async function save(desc: Element): Promise<{ file: string; images: number; missed: number }> {
	const title = m.pageTitle() || "Assignment";
	const name = slug(title);
	const pictures = [...desc.querySelectorAll("img")].filter(isPicture);
	const unique = [...new Set(pictures.map(srcOf))];
	const got = await Promise.all(unique.map(async (url) => [url, await fetchImage(url)] as const));
	const files = new Map<string, string>(), entries: ZipEntry[] = [];
	got.forEach(([url, img]) => {
		if (!img) return;
		const path = `images/image-${files.size + 1}.${img.ext}`;
		files.set(url, path);
		entries.push({ name: `${name}/${path}`, data: img.bytes });
	});
	const md = header(title) + htmlToMarkdown(desc, (img) => (isPicture(img) ? files.get(srcOf(img)) ?? srcOf(img) : null)) + "\n"; // a picture that could not be fetched keeps its web address
	const missed = unique.length - files.size;
	if (!files.size) { download(`${name}.md`, md, "text/markdown;charset=utf-8"); return { file: `${name}.md`, images: 0, missed }; }
	entries.unshift({ name: `${name}/${name}.md`, data: new TextEncoder().encode(md) });
	download(`${name}.zip`, zip(entries) as BlobPart, "application/zip");
	return { file: `${name}.zip`, images: files.size, missed };
}

const descriptionOf = (): HTMLElement | null => document.querySelector<HTMLElement>(".activity-description, #intro");
const isAssignment = (): boolean => /^page-mod-assign-view$/.test(document.body.id);

function mountButton(): void {
	const present = document.querySelector(".mf-save-text");
	const desc = descriptionOf();
	if (!settings.get().save_text || !isAssignment() || !desc?.textContent?.trim() && !desc?.querySelector("img")) { present?.remove(); return; }
	if (present?.isConnected && desc.contains(present)) return;
	present?.remove();
	const label = h("span", {}, "Save as Markdown");
	const status = h("span", { class: "mf-save-status", role: "status" });
	const btn = h("button", { type: "button", class: "btn flex-button mf-save-btn", title: "Saves the description as a .md file, or a .zip with its pictures" }, label);
	btn.onclick = async () => {
		btn.disabled = true; label.textContent = "Saving…"; status.textContent = "";
		try {
			const r = await save(desc);
			label.textContent = "Saved";
			status.textContent = r.images ? `${r.file}: text and ${r.images} picture${r.images === 1 ? "" : "s"}${r.missed ? `. ${r.missed} could not be downloaded, so ${r.missed === 1 ? "its" : "their"} web address is kept` : ""}.` : `${r.file}`;
		} catch { label.textContent = "Save as Markdown"; status.textContent = "Couldn't save the description. Reload the page and try again."; }
		btn.disabled = false;
		setTimeout(() => { label.textContent = "Save as Markdown"; }, RESET_MS);
	};
	desc.append(h("div", { class: "mf-save-text", "data-mf-ui": "" }, btn, status));
}

export function mountSaveText(): void {
	onDomChange(mountButton);
	settings.subscribe((_, changed) => { if (changed.includes("save_text")) mountButton(); });
}
