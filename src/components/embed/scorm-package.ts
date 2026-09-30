/**
 * Turns an unpacked SCORM package into something a sandboxed iframe can load: every file the launch page
 * references becomes a blob URL and the references are rewritten to point at them. Only static references
 * are rewritten (src/href/url()), so packages that load files by script at run time won't work.
 */

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;

/** Package path a reference points at, or null for absolute/external/fragment references and paths that escape the package. */
export function resolveRef(basePath: string, ref: string): string | null {
	const trimmed = ref.trim();
	if (!trimmed || EXTERNAL.test(trimmed)) return null;
	let relative = trimmed.split(/[?#]/)[0];
	try {
		relative = decodeURIComponent(relative);
	} catch {
		// keep it as written
	}
	const parts = basePath.split("/").slice(0, -1);
	for (const part of relative.replace(/\\/g, "/").split("/")) {
		if (part === "..") {
			if (!parts.length) return null;
			parts.pop();
		} else if (part !== "." && part !== "") {
			parts.push(part);
		}
	}
	return parts.length ? parts.join("/") : null;
}

const MIME: Record<string, string> = {
	html: "text/html",
	htm: "text/html",
	xhtml: "text/html",
	css: "text/css",
	js: "text/javascript",
	mjs: "text/javascript",
	json: "application/json",
	xml: "application/xml",
	svg: "image/svg+xml",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	ico: "image/x-icon",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	ogg: "audio/ogg",
	mp4: "video/mp4",
	webm: "video/webm",
	woff: "font/woff",
	woff2: "font/woff2",
	ttf: "font/ttf",
	otf: "font/otf",
	pdf: "application/pdf",
	txt: "text/plain",
};

export const mimeOf = (path: string) => MIME[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

/** Maps a package path to something to put in its place, or null to leave the reference alone. */
export type RefMapper = (packagePath: string) => string | null;

const TAG = /<(script|link|img|image|source|video|audio|iframe|frame|embed|object|track|input)\b[^>]*>/gi;
const ATTR = /(\s(?:src|href|data|poster|xlink:href)\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi;
const STYLE_BLOCK = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;
const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const CSS_IMPORT = /@import\s+(['"])([^'"]+)\1/gi;

/** Rewrites `url(...)` and `@import` references in CSS found at `basePath`. */
export function rewriteCss(css: string, basePath: string, map: RefMapper): string {
	const swap = (ref: string) => {
		const path = resolveRef(basePath, ref);
		return (path && map(path)) ?? null;
	};
	return css
		.replace(CSS_URL, (whole, quote: string, ref: string) => {
			const to = swap(ref);
			return to ? `url(${quote}${to}${quote})` : whole;
		})
		.replace(CSS_IMPORT, (whole, quote: string, ref: string) => {
			const to = swap(ref);
			return to ? `@import ${quote}${to}${quote}` : whole;
		});
}

/** Rewrites static references of an HTML page found at `basePath`; plain `<a>` links are left alone. */
export function rewriteHtml(html: string, basePath: string, map: RefMapper): string {
	const swap = (ref: string) => {
		const path = resolveRef(basePath, ref);
		return path ? map(path) : null;
	};
	return html
		.replace(TAG, (tag) =>
			tag.replace(ATTR, (whole, prefix: string, double?: string, single?: string) => {
				const to = swap(double ?? single ?? "");
				return to ? `${prefix}"${to}"` : whole;
			}),
		)
		.replace(STYLE_BLOCK, (_whole, open: string, css: string, close: string) => open + rewriteCss(css, basePath, map) + close);
}

/** Puts a script at the top of the page's <head>, keeping the doctype first so the page doesn't drop into quirks mode. */
export function injectScript(html: string, script: string): string {
	const tag = `<script>${script}</script>`;
	for (const anchor of [/<head\b[^>]*>/i, /<html\b[^>]*>/i, /<!doctype[^>]*>/i]) {
		const match = anchor.exec(html);
		if (match) return html.slice(0, match.index + match[0].length) + tag + html.slice(match.index + match[0].length);
	}
	return tag + html;
}

/** Case-insensitive lookup: authoring tools and manifests disagree about case surprisingly often. */
export function findFile(files: Map<string, Uint8Array>, path: string): string | null {
	if (files.has(path)) return path;
	const lower = path.toLowerCase();
	for (const key of files.keys()) if (key.toLowerCase() === lower) return key;
	return null;
}

export interface ScoFrame {
	url: string;
	/** Frees the blob URLs; call when the frame goes away. */
	dispose(): void;
}

/** Launch path from the manifest without its query string (which belongs to the SCO, not the file name). */
export const launchPath = (launch: string) => resolveRef("x", launch);

/**
 * Builds the blob URL of a SCO's launch page. Referenced files get blob URLs lazily; `script` (the SCORM API
 * shim) is injected into the launch page only. Returns null when the launch file isn't in the package.
 */
export function buildScoFrame(files: Map<string, Uint8Array>, launch: string, script: string): ScoFrame | null {
	const path = launchPath(launch);
	const key = path && findFile(files, path);
	if (!key) return null;

	const decoder = new TextDecoder();
	const urls = new Map<string, string>();
	const building = new Set<string>();
	const blob = (body: BlobPart, type: string) => URL.createObjectURL(new Blob([body], { type }));

	function urlFor(packagePath: string): string | null {
		const file = findFile(files, packagePath);
		if (!file) return null;
		const known = urls.get(file);
		if (known) return known;
		if (building.has(file)) return null; // pages referencing each other
		building.add(file);
		const type = mimeOf(file);
		const bytes = files.get(file) as Uint8Array<ArrayBuffer>;
		const url =
			type === "text/html"
				? blob(rewriteHtml(decoder.decode(bytes), file, urlFor), "text/html;charset=utf-8")
				: type === "text/css"
					? blob(rewriteCss(decoder.decode(bytes), file, urlFor), "text/css;charset=utf-8")
					: blob(bytes, type);
		building.delete(file);
		urls.set(file, url);
		return url;
	}

	building.add(key);
	const page = injectScript(rewriteHtml(decoder.decode(files.get(key)), key, urlFor), script);
	const url = blob(page, "text/html;charset=utf-8");
	return {
		url,
		dispose() {
			URL.revokeObjectURL(url);
			for (const u of urls.values()) URL.revokeObjectURL(u);
		},
	};
}
