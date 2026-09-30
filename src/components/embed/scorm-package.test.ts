import { deflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildScoFrame, findFile, injectScript, launchPath, mimeOf, resolveRef, rewriteCss, rewriteHtml } from "./scorm-package";
import { readZip, ZipError } from "./scorm-zip";

const text = (s: string) => new TextEncoder().encode(s);

describe("resolveRef", () => {
	it("resolves relative to the referencing file", () => {
		expect(resolveRef("sco1/index.html", "js/app.js")).toBe("sco1/js/app.js");
		expect(resolveRef("sco1/index.html", "../shared/a.css?v=2#x")).toBe("shared/a.css");
		expect(resolveRef("index.html", "./img/a%20b.png")).toBe("img/a b.png");
	});

	it("ignores external, absolute, fragment and escaping references", () => {
		for (const ref of ["https://cdn.example/a.js", "//cdn/a.js", "data:image/png;base64,AA", "javascript:alert(1)", "#top", "/abs/a.js", "", "../../up.js"]) {
			expect(resolveRef("sco/index.html", ref)).toBeNull();
		}
	});
});

describe("rewriting", () => {
	const map = (p: string) => (p.endsWith(".missing") ? null : `blob:${p}`);

	it("rewrites static references in HTML tags only", () => {
		const html = `<link rel="stylesheet" href='css/a.css'><script src="js/a.js"></script><img src="https://x/y.png"><a href="page2.html">next</a><img src="gone.missing">`;
		const out = rewriteHtml(html, "index.html", map);
		expect(out).toContain(`href="blob:css/a.css"`);
		expect(out).toContain(`src="blob:js/a.js"`);
		expect(out).toContain(`src="https://x/y.png"`);
		expect(out).toContain(`href="page2.html"`);
		expect(out).toContain(`src="gone.missing"`);
	});

	it("rewrites url() and @import in CSS and <style>", () => {
		expect(rewriteCss(`a{background:url("../img/a.png")} @import 'b.css'; c{background:url(data:x)}`, "css/main.css", map)).toBe(`a{background:url("blob:img/a.png")} @import 'blob:css/b.css'; c{background:url(data:x)}`);
		expect(rewriteHtml(`<style>p{background:url(a.png)}</style>`, "index.html", map)).toBe(`<style>p{background:url(blob:a.png)}</style>`);
	});
});

describe("injectScript", () => {
	it("goes inside <head>, after the doctype", () => {
		expect(injectScript("<!DOCTYPE html><html><head><title>t</title></head>", "X")).toBe("<!DOCTYPE html><html><head><script>X</script><title>t</title></head>");
		expect(injectScript("<!doctype html><p>hi", "X")).toBe("<!doctype html><script>X</script><p>hi");
		expect(injectScript("<p>hi", "X")).toBe("<script>X</script><p>hi");
	});
});

describe("files", () => {
	it("finds paths case-insensitively and knows mime types", () => {
		const files = new Map([["Content/Index.HTML", new Uint8Array()]]);
		expect(findFile(files, "content/index.html")).toBe("Content/Index.HTML");
		expect(findFile(files, "nope.html")).toBeNull();
		expect(mimeOf("a/b.JS")).toBe("text/javascript");
		expect(mimeOf("a/b.unknown")).toBe("application/octet-stream");
		expect(launchPath("sco/index.html?mode=1")).toBe("sco/index.html");
	});
});

describe("buildScoFrame", () => {
	const created: Blob[] = [];
	afterEach(() => vi.unstubAllGlobals());

	it("injects the shim into the launch page and points assets at blob URLs", async () => {
		vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (b: Blob) => `blob:${created.push(b)}`, revokeObjectURL: vi.fn() }));
		const files = new Map([
			["sco/index.html", text(`<html><head></head><body><script src="app.js"></script><link href="a.css" rel="stylesheet"></body></html>`)],
			["sco/app.js", text("1")],
			["sco/a.css", text("p{background:url(x.png)}")],
			["sco/x.png", new Uint8Array([1])],
		]);
		const frame = buildScoFrame(files, "sco/index.html?x=1", "SHIM();")!;
		const page = await created[created.length - 1].text();
		expect(page).toContain("<head><script>SHIM();</script>");
		expect(page).toMatch(/src="blob:\d+"/);
		expect(page).toMatch(/href="blob:\d+"/);
		const css = await Promise.all(created.map((b) => b.text())).then((all) => all.find((t) => t.startsWith("p{")));
		expect(css).toMatch(/url\(blob:\d+\)/);
		frame.dispose();
		expect(buildScoFrame(files, "missing.html", "")).toBeNull();
	});
});

// minimal zip writer: [name, content, deflate?][]
function zip(entries: [string, string, boolean][]): ArrayBuffer {
	const parts: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const [name, content, deflate] of entries) {
		const raw = Buffer.from(content);
		const data = deflate ? deflateRawSync(raw) : raw;
		const nameBuf = Buffer.from(name);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(deflate ? 8 : 0, 8);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(raw.length, 22);
		local.writeUInt16LE(nameBuf.length, 26);
		const header = Buffer.alloc(46);
		header.writeUInt32LE(0x02014b50, 0);
		header.writeUInt16LE(deflate ? 8 : 0, 10);
		header.writeUInt32LE(data.length, 20);
		header.writeUInt32LE(raw.length, 24);
		header.writeUInt16LE(nameBuf.length, 28);
		header.writeUInt32LE(offset, 42);
		central.push(header, nameBuf);
		parts.push(local, nameBuf, data);
		offset += 30 + nameBuf.length + data.length;
	}
	const cd = Buffer.concat(central);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(entries.length, 10);
	eocd.writeUInt32LE(cd.length, 12);
	eocd.writeUInt32LE(offset, 16);
	const all = Buffer.concat([...parts, cd, eocd]);
	return all.buffer.slice(all.byteOffset, all.byteOffset + all.length) as ArrayBuffer;
}

describe("readZip", () => {
	it("reads stored and deflated entries and skips directories", async () => {
		const files = await readZip(zip([["a/", "", false], ["a/one.txt", "hello", false], ["b\\two.txt", "world ".repeat(50), true]]));
		expect([...files.keys()]).toEqual(["a/one.txt", "b/two.txt"]);
		expect(new TextDecoder().decode(files.get("a/one.txt"))).toBe("hello");
		expect(new TextDecoder().decode(files.get("b/two.txt"))).toBe("world ".repeat(50));
	});

	it("rejects anything that isn't a zip", async () => {
		await expect(readZip(new ArrayBuffer(64))).rejects.toBeInstanceOf(ZipError);
	});

	it("rejects an entry that inflates past its declared size", async () => {
		const buffer = zip([["big.txt", "x".repeat(1000), true]]);
		// central directory: shrink the declared uncompressed size
		const view = new DataView(buffer);
		const eocd = buffer.byteLength - 22;
		view.setUint32(view.getUint32(eocd + 16, true) + 24, 10, true);
		await expect(readZip(buffer)).rejects.toBeInstanceOf(ZipError);
	});
});
