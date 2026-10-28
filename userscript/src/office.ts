// Read-only viewers for zip-based documents (docx / xlsx / pptx / zip) with no dependency: a minimal zip reader on the
// browser's own DecompressionStream, and just enough XML walking to show the text, tables and sheets.
// ponytail: text and tables only — no images, fonts or page layout; use Download for the faithful copy.
import { h } from "./dom";

const MAX_ROWS = 500;
const MAX_COLS = 40;

interface Entry { name: string; size: number; method: number; csize: number; offset: number }
export interface Zip { entries: Entry[]; text(name: string): Promise<string | undefined> }

async function inflate(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Reads the central directory; throws on anything that isn't a plain (non-zip64) archive. */
export function openZip(buf: ArrayBuffer): Zip {
	const v = new DataView(buf), bytes = new Uint8Array(buf);
	let eocd = -1;
	for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
	if (eocd < 0) throw new Error("not a zip");
	const count = v.getUint16(eocd + 10, true);
	let p = v.getUint32(eocd + 16, true);
	const entries: Entry[] = [];
	for (let n = 0; n < count && v.getUint32(p, true) === 0x02014b50; n++) {
		const nameLen = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), comment = v.getUint16(p + 32, true);
		entries.push({
			method: v.getUint16(p + 10, true), csize: v.getUint32(p + 20, true), size: v.getUint32(p + 24, true), offset: v.getUint32(p + 42, true),
			name: new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen)),
		});
		p += 46 + nameLen + extra + comment;
	}
	const text = async (name: string): Promise<string | undefined> => {
		const e = entries.find((x) => x.name === name);
		if (!e) return undefined;
		const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
		const raw = bytes.subarray(start, start + e.csize);
		return new TextDecoder().decode(e.method === 0 ? raw : await inflate(raw));
	};
	return { entries, text };
}

const xml = (s: string): Document => new DOMParser().parseFromString(s, "application/xml");
const kids = (el: Element, name: string): Element[] => [...el.children].filter((c) => c.localName === name);
const num = (a: string, b: string) => parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10);

function table(rows: string[][], head = false): HTMLElement {
	const t = h("table", { class: "mf-doc-table" });
	rows.forEach((r, i) => t.append(h("tr", {}, ...r.map((c) => h(head && i === 0 ? "th" : "td", {}, c)))));
	return t;
}

function runs(p: Element): Node[] {
	const out: Node[] = [];
	for (const r of p.getElementsByTagNameNS("*", "r")) {
		const pr = kids(r, "rPr")[0];
		const on = (n: string) => { const f = pr && kids(pr, n)[0]; return !!f && f.getAttribute("w:val") !== "0" && f.getAttribute("w:val") !== "false"; };
		for (const c of r.children) {
			if (c.localName === "br") out.push(h("br"));
			else if (c.localName === "tab") out.push(document.createTextNode("\t"));
			else if (c.localName === "t") {
				let n: Node = document.createTextNode(c.textContent ?? "");
				if (on("b")) n = h("strong", {}, n);
				if (on("i")) n = h("em", {}, n);
				if (on("u")) n = h("u", {}, n);
				out.push(n);
			}
		}
	}
	return out;
}

function docxBlock(el: Element): Node | undefined {
	if (el.localName === "tbl") {
		return table(kids(el, "tr").map((tr) => kids(tr, "tc").map((tc) => kids(tc, "p").map((p) => p.textContent ?? "").join("\n"))));
	}
	if (el.localName !== "p") return undefined;
	const pPr = kids(el, "pPr")[0];
	const style = (pPr && kids(pPr, "pStyle")[0]?.getAttribute("w:val")) || "";
	const level = /^(?:Heading|Ttulo|Titre)\s?(\d)$/i.exec(style)?.[1] ?? (/^title$/i.test(style) ? "1" : "");
	const bullet = pPr && kids(pPr, "numPr").length ? "• " : "";
	const p = h(level ? (`h${Math.min(6, +level + 1)}` as "h2") : "p", {}, bullet, ...runs(el));
	return p.textContent ? p : h("br");
}

async function docx(z: Zip): Promise<HTMLElement> {
	const body = xml((await z.text("word/document.xml")) ?? "").getElementsByTagNameNS("*", "body")[0];
	if (!body) throw new Error("empty document");
	return h("div", { class: "mf-doc" }, ...[...body.children].map(docxBlock).filter((n): n is Node => !!n));
}

const col = (ref: string): number => [...ref.replace(/\d/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

async function xlsx(z: Zip): Promise<HTMLElement> {
	const shared = xml((await z.text("xl/sharedStrings.xml")) ?? "<x/>");
	const strings = [...shared.getElementsByTagNameNS("*", "si")].map((si) => [...si.getElementsByTagNameNS("*", "t")].map((t) => t.textContent).join(""));
	const names = [...xml((await z.text("xl/workbook.xml")) ?? "<x/>").getElementsByTagNameNS("*", "sheet")].map((s) => s.getAttribute("name") ?? "");
	const sheets = z.entries.map((e) => e.name).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(num);
	const root = h("div", { class: "mf-doc" });
	for (const [i, path] of sheets.entries()) {
		const rows: string[][] = [];
		for (const row of xml((await z.text(path)) ?? "<x/>").getElementsByTagNameNS("*", "row")) {
			if (rows.length >= MAX_ROWS) break;
			const cells: string[] = [];
			for (const c of kids(row, "c")) {
				const at = col(c.getAttribute("r") ?? "");
				if (at < 0 || at >= MAX_COLS) continue;
				const v = kids(c, "v")[0]?.textContent ?? "";
				cells[at] = c.getAttribute("t") === "s" ? strings[+v] ?? "" : c.getAttribute("t") === "inlineStr" ? c.textContent ?? "" : v;
			}
			rows.push(Array.from(cells, (x) => x ?? ""));
		}
		root.append(h("h3", {}, names[i] || `Sheet ${i + 1}`), rows.length ? table(rows) : h("p", {}, "Empty sheet."));
		if (rows.length >= MAX_ROWS) root.append(h("p", { class: "mf-preview-note" }, `Showing the first ${MAX_ROWS} rows.`));
	}
	return root;
}

async function pptx(z: Zip): Promise<HTMLElement> {
	const slides = z.entries.map((e) => e.name).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(num);
	const root = h("div", { class: "mf-doc" });
	for (const [i, path] of slides.entries()) {
		const paras = [...xml((await z.text(path)) ?? "<x/>").getElementsByTagNameNS("*", "p")].map((p) => p.textContent ?? "").filter(Boolean);
		root.append(h("section", { class: "mf-slide" }, h("h3", {}, `Slide ${i + 1}`), ...paras.map((t) => h("p", {}, t))));
	}
	return root;
}

const size = (n: number) => n > 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
function listing(z: Zip): HTMLElement {
	return h("div", { class: "mf-doc" }, table([["Name", "Size"], ...z.entries.filter((e) => !e.name.endsWith("/")).map((e) => [e.name, size(e.size)])], true));
}

/** Renders a zip-based file as DOM; throws if it can't be read (the caller falls back to a download note). */
export async function renderOffice(kind: "docx" | "xlsx" | "pptx" | "zip", buf: ArrayBuffer): Promise<HTMLElement> {
	const z = openZip(buf);
	return kind === "docx" ? docx(z) : kind === "xlsx" ? xlsx(z) : kind === "pptx" ? pptx(z) : listing(z);
}

/** Pure: delimiter-separated text → rows (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
	const first = text.slice(0, text.search(/\r?\n/) < 0 ? undefined : text.search(/\r?\n/));
	const sep = [",", ";", "\t"].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
	const rows: string[][] = [];
	let row: string[] = [], cell = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
		else if (c === '"') q = true;
		else if (c === sep) { row.push(cell); cell = ""; }
		else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
		else cell += c;
	}
	if (cell || row.length) { row.push(cell); rows.push(row); }
	return rows;
}

export const csvTable = (text: string): HTMLElement => table(parseCsv(text).slice(0, MAX_ROWS), true);
