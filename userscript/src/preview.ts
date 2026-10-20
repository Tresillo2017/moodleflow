// File preview: clicking a file link opens it in bleh's modal instead of navigating away or forcing a download.
// The file is fetched with the user's own session (same origin) and shown from a blob URL; anything we can't show
// (Office documents, archives, pages) falls through to the normal navigation. Ctrl/⌘/Shift/middle-click always bypass.
import * as settings from "./settings";
import { h } from "./dom";

export type Kind = "pdf" | "image" | "video" | "audio" | "text";
const EXT: Record<string, Kind> = {
	pdf: "pdf",
	png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image", avif: "image", bmp: "image",
	mp4: "video", webm: "video", ogv: "video", m4v: "video", mov: "video",
	mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio", flac: "audio",
	txt: "text", md: "text", csv: "text", json: "text", xml: "text", log: "text", js: "text", ts: "text", py: "text", java: "text", c: "text", cpp: "text", h: "text", css: "text", sql: "text", yml: "text", yaml: "text",
};
const MAX_BYTES = 80 * 1024 * 1024;
const MAX_TEXT = 1024 * 1024;

/** Pure: what to show a response as, from its content type, falling back to the file extension. */
export function kindFor(contentType: string, path: string): Kind | undefined {
	const type = contentType.split(";")[0].trim().toLowerCase();
	if (type === "application/pdf") return "pdf";
	if (/^(image|video|audio)\//.test(type)) return type.split("/")[0] as Kind;
	if (/^(text\/(plain|csv|markdown|xml)|application\/(json|xml))$/.test(type)) return "text";
	if (type && type !== "application/octet-stream" && type !== "binary/octet-stream") return undefined; // html, office, zip…
	return EXT[path.split(".").pop()?.toLowerCase() ?? ""];
}

/** Pure: links we'd open ourselves — a resource's view page (type unknown until fetched) or a pluginfile with a known extension. */
export function isFileLink(url: URL, origin: string): boolean {
	if (url.origin !== origin) return false;
	if (/\/mod\/resource\/view\.php$/.test(url.pathname)) return url.searchParams.has("id");
	return /\/pluginfile\.php\//.test(url.pathname) && !url.searchParams.has("forcedownload") && !!EXT[url.pathname.split(".").pop()?.toLowerCase() ?? ""];
}

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
	const prev = h("button", { type: "button", class: "btn flex-button", "aria-label": "Previous file" }, "←");
	const next = h("button", { type: "button", class: "btn flex-button", "aria-label": "Next file" }, "→");
	const closeBtn = h("button", { type: "button", class: "btn modal-close-button icon-mask", "aria-label": "Close", "data-type": "close" }, "Close");
	closeBtn.onclick = close;
	const modal = h("div", { class: "bleh-modal", "data-modal-type": "preview", role: "dialog", "aria-label": "File preview" },
		h("div", { class: "bleh-modal-title" }, h("div", {}, title, sub)), closeBtn,
		h("div", { class: "bleh-modal-body" }, stage),
		h("div", { class: "mf-preview-bar" }, all.length > 1 ? prev : null, all.length > 1 ? next : null, h("span", { class: "mf-spacer" }), tab, dl));
	const el = h("div", { class: "bleh-modals has-dialog" }, modal);
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
		tab.href = href;
		prev.disabled = i === 0; next.disabled = i === all.length - 1;
		try {
			const res = await fetch(href, { credentials: "include" });
			const kind = res.ok ? kindFor(res.headers.get("content-type") ?? "", new URL(res.url).pathname) : undefined;
			if (mine !== gen) return;
			if (!kind || +(res.headers.get("content-length") ?? 0) > MAX_BYTES) { close(); location.assign(href); return; } // not ours to show
			const name = fileName(res.url) || "file";
			title.textContent = name;
			dl.download = name;
			if (kind === "text") {
				const text = (await res.text()).slice(0, MAX_TEXT);
				if (mine !== gen) return;
				stage.replaceChildren(h("pre", { class: "mf-preview-text" }, text));
				dl.href = tab.href = href;
				return;
			}
			const blob = await res.blob();
			if (mine !== gen) return;
			objectUrl = URL.createObjectURL(blob);
			dl.href = objectUrl;
			const node = kind === "pdf" ? h("iframe", { src: objectUrl, title: name })
				: kind === "image" ? h("img", { src: objectUrl, alt: name })
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
		if (!a || a.target === "_blank" || a.hasAttribute("download") || a.closest(".masthead, .bleh-modals, [data-mf-settings]")) return;
		let url: URL;
		try { url = new URL(a.href); } catch { return; }
		if (!isFileLink(url, location.origin)) return;
		e.preventDefault();
		const all = links().map((l) => l.href);
		void open(all.includes(a.href) ? all : [a.href, ...all], Math.max(0, all.indexOf(a.href)));
	}, true);
}
