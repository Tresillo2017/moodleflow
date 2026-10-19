// Copies the built userscript into public/ and writes its metadata block on its own.
// Run after `sh userscript/build.sh` (see the "build" script in package.json).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const source = path.join(root, "userscript", "moodleflow.user.js");
const publicDir = path.join(root, "public");

const script = fs.readFileSync(source, "utf8");
const meta = script.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
if (!meta) throw new Error(`no ==UserScript== block found in ${source}`);

fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(source, path.join(publicDir, "moodleflow.user.js"));
fs.writeFileSync(path.join(publicDir, "moodleflow.meta.js"), `${meta[0]}\n`);
console.log(`public/moodleflow.user.js (${script.length} bytes), public/moodleflow.meta.js`);
