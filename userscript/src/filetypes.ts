// File activities (the "resource" module) all show Moodle's tiny generic file icon. This tags each one with its kind and
// extension label (PDF, PPT, SQL …) so moodle.css can draw a coloured type badge instead. Only the tile is touched.
import * as settings from "./settings";
import { onDomChange } from "./watch";

export type Kind = { kind: string; label: string };
const KINDS: [string, string, RegExp][] = [
	["pdf", "PDF", /\bpdf\b|\/f\/pdf/],
	["ppt", "PPT", /\bppt|powerpoint|presentation|\bodp\b|\bkey\b|\/f\/powerpoint/],
	["xls", "XLS", /\bxls|\bcsv\b|\bods\b|spreadsheet|\/f\/(spreadsheet|calc)/],
	["doc", "DOC", /\bdoc|\bodt\b|\brtf\b|word|\/f\/document/],
	["sql", "SQL", /\bsql\b|\.sql\b|\bsqlite\b|\/f\/database/],
	["zip", "ZIP", /\bzip\b|\brar\b|\b7z\b|\btar\b|\bgz\b|archive|\/f\/archive/],
	["img", "IMG", /\b(png|jpe?g|gif|svg|webp|bmp)\b|\bimage\b|\/f\/(image|jpeg|png|gif)/],
	["vid", "VID", /\b(mp4|mov|avi|mkv|webm)\b|\bvideo\b|\/f\/(video|mpeg|avi)/],
	["aud", "AUD", /\b(mp3|wav|ogg|flac|m4a)\b|\baudio\b|\/f\/(audio|mp3|wav)/],
	["code", "CODE", /\b(py|js|ts|java|c|cpp|cs|php|html?|css|json|xml|sh|rb|go|rs)\b|source ?code|\/f\/(sourcecode|html|markup)/],
	["txt", "TXT", /\btxt\b|\bmd\b|plain text|text file|\/f\/(text|plaintext)/],
];

/** Pure: what kind of file is this, going by the icon's url and whatever text the row shows (name, "PDF · 2 MB" …). */
export function fileKind(iconSrc: string, text: string): Kind | undefined {
	const icon = /\/f\/([\w-]+)/.exec(iconSrc)?.[0] ?? ""; // just "/f/pdf-24": the rest of the url ("image.php/boost/core") says nothing about the file
	const hay = `${icon} ${text}`.toLowerCase();
	for (const [kind, label, re] of KINDS) if (re.test(hay)) return { kind, label };
	return undefined;
}

function tag(roots: Element[]): void {
	const on = settings.get().file_icons;
	for (const root of roots) {
		const rows = root.matches("li.activity.resource") ? [root] : [...root.querySelectorAll("li.activity.resource")];
		for (const li of rows) {
			const tile = li.querySelector<HTMLElement>(".activityiconcontainer");
			if (!tile) continue;
			const k = on ? fileKind(li.querySelector<HTMLImageElement>("img.activityicon")?.src ?? "", `${li.querySelector(".instancename")?.firstChild?.textContent ?? ""} ${li.querySelector(".resourcelinkdetails")?.textContent ?? ""}`) : undefined;
			if (k) { tile.dataset.mfFile = k.kind; tile.dataset.mfExt = k.label; }
			else { delete tile.dataset.mfFile; delete tile.dataset.mfExt; }
		}
	}
}

export function mountFileTypes(): void {
	onDomChange(tag);
	settings.subscribe((_, c) => { if (c.includes("file_icons")) tag([document.body]); });
}
