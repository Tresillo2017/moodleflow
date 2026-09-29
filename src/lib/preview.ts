import { marked } from "marked";

/** Minimal RFC 4180 parser: quoted fields, escaped quotes and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
			else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === "," || c === ";" || c === "\t") { row.push(field); field = ""; }
		else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(field); rows.push(row); row = []; field = "";
		} else field += c;
	}
	if (field !== "" || row.length) { row.push(field); rows.push(row); }
	return rows;
}

interface Cell { cell_type: string; source: string | string[] }

/** A Jupyter notebook as markdown: markdown cells verbatim, code cells fenced (outputs are dropped). */
export function notebookToMarkdown(json: string): string {
	const nb = JSON.parse(json) as { cells?: Cell[]; metadata?: { language_info?: { name?: string } } };
	const lang = nb.metadata?.language_info?.name ?? "";
	return (nb.cells ?? [])
		.map((c) => {
			const src = Array.isArray(c.source) ? c.source.join("") : c.source;
			return c.cell_type === "code" ? "```" + lang + "\n" + src + "\n```" : src;
		})
		.join("\n\n");
}

export const markdownToHtml = (md: string): string => marked.parse(md, { async: false });
