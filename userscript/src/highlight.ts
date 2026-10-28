// Tiny syntax highlighter for the file preview: comments, strings, numbers and keywords, one regex per comment style.
// ponytail: not a parser (no nesting, no regex literals); swap in highlight.js if exactness ever matters.
const KEYWORDS = new Set(`abstract and as assert async await begin bool boolean break by case catch char class const constructor continue def default defer del delete do double elif else elsif end enum except exports extends false fi final finally fn for foreach from func function go if implements import in instanceof int interface is lambda let long match module mut namespace new nil none not null of on or package pass private protected pub public raise readonly return select self static string struct super switch then this throw throws trait true try type typeof union unsigned use using val var void volatile when where while with yield
add alter by create database distinct drop exists group having index inner insert into join key left limit order outer primary references right set table unique update values view
SELECT FROM WHERE INSERT INTO VALUES UPDATE DELETE CREATE TABLE ALTER DROP JOIN INNER LEFT RIGHT OUTER ON AND OR NOT NULL AS ORDER BY GROUP HAVING LIMIT PRIMARY KEY FOREIGN REFERENCES INDEX UNIQUE DEFAULT SET DISTINCT UNION VIEW DATABASE IF EXISTS`.split(/\s+/));

const HASH = new Set(["py", "sh", "bash", "zsh", "yml", "yaml", "rb", "r", "toml", "ini", "pl", "ps1", "conf"]);
const DASH = new Set(["sql", "lua", "hs"]);
const MARKUP = new Set(["html", "htm", "xml", "svg"]);
const NO_COMMENT = new Set(["json", "txt", "log", "md"]);

const cache = new Map<string, RegExp>();
function grammar(ext: string): RegExp {
	let re = cache.get(ext);
	if (!re) {
		const comment = MARKUP.has(ext) ? "<!--[\\s\\S]*?-->" : NO_COMMENT.has(ext) ? "(?!)" : HASH.has(ext) ? "#[^\\n]*" : DASH.has(ext) ? "--[^\\n]*" : "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/";
		const triple = ext === "py" ? `"""[\\s\\S]*?"""|'''[\\s\\S]*?'''|` : "";
		// groups: 1 comment, 2 string, 3 number, 4 word
		re = new RegExp(`(${comment})|(${triple}"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|(\\b\\d[\\d_.]*(?:e[+-]?\\d+)?\\b|\\b0x[\\da-f]+\\b)|(\\b[A-Za-z_]\\w*\\b)`, "gi");
		cache.set(ext, re);
	}
	re.lastIndex = 0;
	return re;
}

const MAX_HIGHLIGHT = 300 * 1024;
const span = (cls: string, text: string): HTMLSpanElement => { const s = document.createElement("span"); s.className = cls; s.textContent = text; return s; };

/** Text → fragment with token spans; plain text when it's too big to be worth it. */
export function highlight(text: string, ext: string): DocumentFragment {
	const out = document.createDocumentFragment();
	if (text.length > MAX_HIGHLIGHT) { out.append(text); return out; }
	const re = grammar(ext);
	let last = 0;
	for (let m = re.exec(text); m; m = re.exec(text)) {
		const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "n" : KEYWORDS.has(m[4]) ? "k" : "";
		if (!cls) continue;
		if (m.index > last) out.append(text.slice(last, m.index));
		out.append(span(`mf-tk-${cls}`, m[0]));
		last = m.index + m[0].length;
	}
	out.append(text.slice(last));
	return out;
}
