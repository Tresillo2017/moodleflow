// File preview: clicking a file link opens it in bleh's modal instead of navigating away or forcing a download.
// The file is fetched with the user's own session (same origin) and shown from a blob URL; anything we can't show
// (Office documents, archives, pages) falls through to the normal navigation. Ctrl/⌘/Shift/middle-click always bypass.
import * as settings from "./settings";
import { h } from "./dom";

import { renderOffice, csvTable } from "./office";
import { highlight } from "./highlight";

export type Kind = "pdf" | "image" | "video" | "audio" | "text" | "csv" | "docx" | "xlsx" | "pptx" | "zip";
const group = (kind: Kind, exts: string) => Object.fromEntries(exts.split(" ").map((e) => [e, kind] as const));
const EXT: Record<string, Kind> = {
	pdf: "pdf",
	...group("image", "png jpg jpeg gif webp svg avif bmp ico"),
	...group("video", "mp4 webm ogv m4v mov"),
	...group("audio", "mp3 wav ogg m4a flac aac opus"),
	...group("csv", "csv tsv"),
	...group("docx", "docx"), ...group("xlsx", "xlsx"), ...group("pptx", "pptx"), ...group("zip", "zip"),
	...group("text", "txt md log json xml yml yaml toml ini conf env js mjs jsx ts tsx py java kt kts scala groovy c h cpp cc hpp cs go rs rb php swift dart lua pl r sql sh bash zsh ps1 bat css scss less vue svelte gradle tex srt vtt"),
};
const BINARY: Kind[] = ["docx", "xlsx", "pptx", "zip"];
const MAX_BYTES = 80 * 1024 * 1024;
const MAX_TEXT = 1024 * 1024;

/** Pure: what to show a response as. Office / zip / csv go by extension (servers label them octet-stream or oddly), the rest by content type, then extension. */
export function kindFor(contentType: string, path: string): Kind | undefined {
	const type = contentType.split(";")[0].trim().toLowerCase();
	const byExt = EXT[path.split(".").pop()?.toLowerCase() ?? ""];
	if (type === "text/html" || type === "application/xhtml+xml") return undefined; // a page, not the file
	if (byExt && (BINARY.includes(byExt) || byExt === "csv")) return byExt;
	if (type === "application/pdf") return "pdf";
	if (/^(image|video|audio)\//.test(type)) return type.split("/")[0] as Kind;
	if (/^text\//.test(type) || /^application\/(json|xml|sql|x-sh|javascript)$/.test(type)) return "text";
	if (type && type !== "application/octet-stream" && type !== "binary/octet-stream") return undefined;
	return byExt;
}

/** Pure: links we'd open ourselves — a resource's view page (type unknown until fetched) or a pluginfile with a known extension. */
export function isFileLink(url: URL, origin: string): boolean {
	if (url.origin !== origin) return false;
	if (/\/mod\/resource\/view\.php$/.test(url.pathname)) return url.searchParams.has("id");
	return /\/pluginfile\.php\//.test(url.pathname) && !!EXT[url.pathname.split(".").pop()?.toLowerCase() ?? ""];
}

const zoomable = (img: HTMLImageElement): HTMLImageElement => { img.title = "Click to zoom"; img.onclick = () => img.classList.toggle("mf-zoom"); return img; };
const fileName = (u: string) => { try { return decodeURIComponent(new URL(u).pathname.split("/").pop() ?? ""); } catch { return ""; } };
const links = (): HTMLAnchorElement[] => {
	const seen = new Set<string>();
	return [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].filter((a) => !a.closest(".masthead, .bleh-modals") && isFileLink(new URL(a.href), location.origin) && !seen.has(a.href) && !!seen.add(a.href));
};

let wrap: HTMLElement | undefined;
let gen = 0; // newest load wins when the user flips through files quickly
let objectUrl: string | undefined;

function close(): void {
	if (!wrap) return;
	const el = wrap;
	wrap = undefined;
	gen++;
	if (objectUrl) URL.revokeObjectURL(objectUrl);
	objectUrl = undefined;
	el.querySelector(".bleh-modal")?.classList.add("to-remove");
	setTimeout(() => el.remove(), 300);
	removeEventListener("keydown", onKey, true);
}
let step: (d: number) => void = () => {};
function onKey(e: KeyboardEvent): void {
	if (e.key === "Escape") { e.preventDefault(); close(); }
	else if (e.key === "ArrowLeft" && !e.altKey) step(-1);
	else if (e.key === "ArrowRight" && !e.altKey) step(1);
}

async function open(all: string[], index: number): Promise<void> {
	if (wrap) close();
	let i = index;
	const title = h("h4", {}, "…");
	const sub = h("div", { class: "bleh-modal-subtitle" }, "Loading…");
	const stage = h("div", { class: "mf-preview-stage" });
	const dl = h("a", { class: "btn flex-button", download: "" }, "Download");
	const tab = h("a", { class: "btn flex-button", target: "_blank", rel: "noopener" }, "Open");
	const copy = h("button", { type: "button", class: "btn flex-button" }, "Copy");
	copy.hidden = true;
	const prev = h("button", { type: "button", class: "btn flex-button", "aria-label": "Previous file" }, "←");
	const next = h("button", { type: "button", class: "btn flex-button", "aria-label": "Next file" }, "→");
	const closeBtn = h("button", { type: "button", class: "btn modal-close-button icon-mask", "aria-label": "Close", "data-type": "close" }, "Close");
	closeBtn.onclick = close;
	const modal = h("div", { class: "bleh-modal", "data-modal-type": "preview", role: "dialog", "aria-label": "File preview" },
		h("div", { class: "bleh-modal-title" }, h("div", {}, title, sub)), closeBtn,
		h("div", { class: "bleh-modal-body" }, stage),
		h("div", { class: "mf-preview-bar" }, all.length > 1 ? prev : null, all.length > 1 ? next : null, h("span", { class: "mf-spacer" }), copy, tab, dl));
	const el = h("div", { class: "bleh-modals has-dialog mf-preview-open" }, modal);
	el.addEventListener("mousedown", (e) => { if (e.target === el) close(); });
	document.body.append(el);
	wrap = el;
	addEventListener("keydown", onKey, true);

	const load = async (): Promise<void> => {
		const mine = ++gen;
		const href = all[i];
		if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = undefined; }
		stage.replaceChildren(h("div", { class: "mf-preview-note" }, "Loading…"));
		sub.textContent = `${i + 1} of ${all.length}`;
		tab.href = href.replace(/([?&])forcedownload=1&?/, "$1").replace(/[?&]$/, "");
		prev.disabled = i === 0; next.disabled = i === all.length - 1;
		try {
			const res = await fetch(href, { credentials: "include" }); // forcedownload only changes a header, the bytes are the same
			const kind = res.ok ? kindFor(res.headers.get("content-type") ?? "", new URL(res.url).pathname) : undefined;
			if (mine !== gen) return;
			if (!kind || +(res.headers.get("content-length") ?? 0) > MAX_BYTES) { close(); location.assign(href); return; } // not ours to show
			const name = fileName(res.url) || "file";
			title.textContent = name;
			dl.download = name;
			const ext = name.split(".").pop()?.toLowerCase() ?? "";
			copy.hidden = true;
			if (kind === "text" || kind === "csv") {
				const raw = await res.text();
				if (mine !== gen) return;
				const cut = raw.length > MAX_TEXT;
				let text = cut ? raw.slice(0, MAX_TEXT) : raw;
				if (ext === "json" && !cut) try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* shown as-is */ }
				const note = cut ? h("div", { class: "mf-preview-note" }, "Showing the first 1 MB. Download for the rest.") : null;
				stage.replaceChildren(kind === "csv" ? h("div", { class: "mf-preview-scroll" }, csvTable(text), note) : h("pre", { class: "mf-preview-text" }, highlight(text, ext), note));
				copy.hidden = false;
				copy.onclick = () => { void navigator.clipboard.writeText(text).then(() => { copy.textContent = "Copied"; setTimeout(() => (copy.textContent = "Copy"), 1200); }); };
				dl.href = href;
				return;
			}
			if (kind === "docx" || kind === "xlsx" || kind === "pptx" || kind === "zip") {
				const buf = await res.arrayBuffer();
				if (mine !== gen) return;
				let doc: HTMLElement;
				try { doc = await renderOffice(kind, buf); } catch { if (mine === gen) stage.replaceChildren(h("div", { class: "mf-preview-note" }, "Can't preview this file here. Use Download.")); dl.href = href; return; }
				if (mine !== gen) return;
				stage.replaceChildren(h("div", { class: "mf-preview-scroll" }, doc));
				dl.href = href;
				return;
			}
			const blob = await res.blob();
			if (mine !== gen) return;
			objectUrl = URL.createObjectURL(blob);
			dl.href = objectUrl;
			const node = kind === "pdf" ? h("iframe", { src: objectUrl, title: name })
				: kind === "image" ? zoomable(h("img", { src: objectUrl, alt: name }))
				: h(kind, { src: objectUrl, controls: "" });
			stage.replaceChildren(node);
		} catch {
			if (mine === gen) { close(); location.assign(href); }
		}
	};
	step = (d) => { const n = i + d; if (n >= 0 && n < all.length) { i = n; void load(); } };
	prev.onclick = () => step(-1);
	next.onclick = () => step(1);
	await load();
}

export function mountPreview(): void {
	document.addEventListener("click", (e) => {
		if (!settings.get().file_preview || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
		const a = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
		if (!a || a.hasAttribute("download") || a.closest(".masthead, .bleh-modals, [data-mf-settings]")) return;
		let url: URL;
		try { url = new URL(a.href); } catch { return; }
		if (!isFileLink(url, location.origin)) return;
		e.preventDefault();
		const all = links().map((l) => l.href);
		void open(all.includes(a.href) ? all : [a.href, ...all], Math.max(0, all.indexOf(a.href)));
	}, true);
}
