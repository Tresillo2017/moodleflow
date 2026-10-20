// bun changelog.mjs — turns ../CHANGELOG.md (Keep a Changelog) into dist/changelog.json for the in-page "Times" dialog.
import fs from "node:fs";
const md = fs.readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const out = [];
let rel = null, sec = null;
for (const line of md.split("\n")) {
	const h2 = /^## \[(\d+\.\d+\.\d+)\](?: - (\d{4}-\d{2}-\d{2}))?/.exec(line);
	if (h2) { rel = { version: h2[1], date: h2[2] ?? "", type: h2[1].endsWith(".0") ? "major" : "minor", sections: [] }; out.push(rel); sec = null; continue; }
	if (/^## /.test(line)) { rel = null; continue; } // [Unreleased] and anything else
	const h3 = /^### (.+)/.exec(line);
	if (h3 && rel) { sec = { title: h3[1].trim(), items: [] }; rel.sections.push(sec); continue; }
	const li = /^- (.+)/.exec(line);
	if (li && sec) sec.items.push(li[1].trim());
	else if (sec && /^\s+\S/.test(line) && sec.items.length) sec.items[sec.items.length - 1] += " " + line.trim();
}
fs.mkdirSync(new URL("dist/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("dist/changelog.json", import.meta.url), JSON.stringify(out.filter((r) => r.sections.length)));
console.log("changelog:", out.length, "releases");
