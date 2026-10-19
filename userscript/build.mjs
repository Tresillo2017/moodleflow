// Build step for the CSS: vendor/bleh/ stays an untouched copy of bleh's styles; everything below happens to the
// *bundle*, not to those files. Goal: the userscript injects ~1.4 MB of css on every page, which costs hundreds of ms
// of parsing and style recalculation on each navigation. We cut that down by
//   1. not bundling the stylesheets of Last.fm-only features (music, profiles, minis, events, …),
//   2. moving huge embedded images (seasonal decorations, papers) into lazy chunks that load only when needed,
//   3. dropping icon definitions nothing references,
//   4. dropping the Google Fonts @imports (src/fonts.ts loads just the families in use).
import esbuild from "esbuild";
import postcss from "postcss";
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);

// ---- 1. skip imports of Last.fm-only stylesheets (matched against the @import path text) ----
const DEAD = [
	/\.\.\/music\//, /\.\.\/profile\//, /\.\.\/minis\//, /\.\.\/home\//, /\.\.\/event\//, /\.\.\/text\/(shout|markdown)/,
	/\.\/(playback|translate|profile|auto_edit|pro|privacy|api|test)\.css/, // settings/page/*
	/\.\/(edit_scrobble|calendar|bulk_edit|news|sponsor|scrobble|share|status|avatar|edit_avatar|timeframe|mini_window|notices|external)\.css/, // dialog/*
	/\.\/labs\.css/,
];
const pruneImports = {
	name: "prune-lastfm-imports",
	setup(build) {
		build.onLoad({ filter: /styles[\\/](page[\\/]page|settings[\\/]page[\\/]main|dialog[\\/]main)\.css$/ }, (args) => {
			const text = fs.readFileSync(args.path, "utf8");
			const kept = text.split("\n").filter((l) => !(/^\s*@import/.test(l) && DEAD.some((re) => re.test(l)))).join("\n");
			return { contents: kept, loader: "css", resolveDir: path.dirname(args.path) };
		});
	},
};

const bundled = await esbuild.build({
	entryPoints: [path.join(root, "vendor/bleh/index.css")], bundle: true, write: false, outfile: "bleh.css", logLevel: "error",
	plugins: [pruneImports],
});
const raw = bundled.outputFiles[0].text;

// ---- 2-4. postcss over the bundle ----
const ast = postcss.parse(raw);

// 4. google fonts imports go; fonts.ts takes over
ast.walkAtRules("import", (r) => { if (/fonts\.googleapis\.com/.test(r.params)) r.remove(); });

// 3a. rules that only target Last.fm component classes (chartlists, scrobbles, galleries, …) can never match a Moodle page
const DEAD_CLASS = /\.(chartlist|library-|shout|scrobble|obsession|playlisting|gallery-|listening-report|catalogue|music-|wiki|lyrics|big-tags|source-album|weeklychart|user-list|inbox|player-bar|oracle|lotus|taste|streak|collage|campfire|attendance|lineup|venue|nag-bar|artist-|track-|album-|header-new|profile-|glacier|similar-|featured-item|bleh-now|rabbit-search-)/;
let deadRules = 0;
ast.walkRules((r) => {
	const sels = r.selectors;
	if (sels.length && sels.every((sel) => DEAD_CLASS.test(sel))) { r.remove(); deadRules++; }
});
// 3. icon definitions nothing references
const sourceText = ["src", "src/styles"].flatMap((d) => fs.readdirSync(path.join(root, d)).filter((f) => /\.(ts|css)$/.test(f)).map((f) => fs.readFileSync(path.join(root, d, f), "utf8"))).join("\n");
const defs = new Map(); // name -> decl
ast.walkDecls(/^--icon-/, (d) => { if (d.parent?.type === "rule" && d.parent.selector === ":root") defs.set(d.prop, d); });
const refs = (text) => [...text.matchAll(/var\(\s*(--icon-[a-z0-9-]+)/g)].map((m) => m[1]);
// icons our own code/css use go in the core sheet; ones only bleh's rules reference can wait for idle; the rest are dropped
const direct = new Set(refs(sourceText));
for (const name of defs.keys()) { // named only as plain strings in our code (e.g. "settings" -> --icon-16-settings)
	const short = name.replace(/^--icon-(16-)?/, "");
	if (new RegExp(`["'\`]${short}["'\`]`).test(sourceText)) direct.add(name);
}
const indirect = new Set();
ast.walkDecls((d) => { if (defs.get(d.prop) !== d) for (const n of refs(d.value)) indirect.add(n); });
const closure = (set) => { for (let grew = true; grew;) { grew = false; for (const [name, d] of defs) if (set.has(name)) for (const n of refs(d.value)) if (!set.has(n)) { set.add(n); grew = true; } } };
closure(direct); closure(indirect);
let droppedIcons = 0, deferredIcons = 0;
const deferred = postcss.rule({ selector: ":root" });
for (const [name, d] of defs) {
	if (direct.has(name)) continue;
	if (indirect.has(name)) { deferred.append(postcss.decl({ prop: d.prop, value: d.value })); deferredIcons++; } else droppedIcons++;
	d.remove();
}

// 2. huge data-URI custom properties -> lazy buckets, keyed by what makes them necessary
const BIG = 3000;
const lazy = {};
const chain = (node) => { const c = []; for (let n = node.parent; n && n.type !== "root"; n = n.parent) c.unshift(n); return c; };
const bucketOf = (ancestors) => {
	const sel = ancestors.map((a) => a.selector || "").join(" ");
	if (/data-bleh--season/.test(sel)) return "season";
	const t = sel.match(/data-bleh--theme="([a-z_]+)"/);
	return t ? `theme:${t[1]}` : "other";
};
const toRemove = [];
lazy.icons = postcss.root();
lazy.icons.append(deferred);
ast.walkDecls((d) => {
	if (d.value.length < BIG || !/data:/.test(d.value) || defs.get(d.prop) === d) return;
	const ancestors = chain(d);
	const bucket = bucketOf(ancestors);
	// rebuild the same nesting around just this declaration
	let inner = postcss.decl({ prop: d.prop, value: d.value, important: d.important });
	for (let i = ancestors.length - 1; i >= 0; i--) {
		const a = ancestors[i];
		const copy = a.type === "atrule" ? postcss.atRule({ name: a.name, params: a.params }) : postcss.rule({ selector: a.selector });
		copy.append(inner);
		inner = copy;
	}
	(lazy[bucket] ||= postcss.root()).append(inner);
	toRemove.push(d);
});
for (const d of toRemove) d.remove();
ast.walk((n) => { if ((n.type === "rule" || n.type === "atrule") && n.nodes && n.nodes.length === 0 && !(n.type === "atrule" && /^(import|charset|font-face)$/.test(n.name))) n.remove(); });

const min = async (css) => (await esbuild.transform(css, { loader: "css", minify: true })).code;
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
const core = await min(ast.toString());
fs.writeFileSync(path.join(root, "dist/core.css"), core);
const lazyOut = {};
for (const [k, r] of Object.entries(lazy)) lazyOut[k] = await min(r.toString());
fs.writeFileSync(path.join(root, "dist/lazy.json"), JSON.stringify(lazyOut));

const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`dead rules removed: ${deadRules}`);
console.log(`css: ${kb(raw.length)} bundled -> core ${kb(core.length)} + lazy ${Object.entries(lazyOut).map(([k, v]) => `${k} ${kb(v.length)}`).join(", ")}; icons: ${defs.size - droppedIcons - deferredIcons} in core, ${deferredIcons} deferred, ${droppedIcons} dropped`);
