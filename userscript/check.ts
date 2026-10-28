// bun check.ts — smoke checks for the pure logic (no DOM): accent maths, css url parsing, settings, seasons, search scoring.
import { strict as assert } from "node:assert";
(globalThis as any).matchMedia = (q: string) => ({ matches: /dark/.test(q) ? (globalThis as any).__dark === true : false, addEventListener() {} });
const { rgbToOklch, accentFromRgb, cssUrl } = await import("./src/backdrop");
const { DEFAULTS, THEMES, sanitize } = await import("./src/settings");
const { effectiveTheme } = await import("./src/apply");
const { seasonState, SEASONS } = await import("./src/seasonal");
const { score } = await import("./src/rabbit");
const { lightness, tagsFor } = await import("./src/fix");
const { isNewer, parseVersion } = await import("./src/updater");
const { kindFor, isFileLink } = await import("./src/preview");
const { neighbours } = await import("./src/coursenav");
const { bucket } = await import("./src/deadlines");
const { pushVisit } = await import("./src/resume");
const { unseen } = await import("./src/unread");
const { step, GO } = await import("./src/keys");
const { isActivityLink } = await import("./src/popout");
const { fileKind } = await import("./src/filetypes");
const { greeting, firstName, courseState, inTab } = await import("./src/home");
const { perDay } = await import("./src/deadlines");
const { isHomePath } = await import("./src/api");
const { isFresh, burst } = await import("./src/celebrate");

// bleh's accent-from-image maths
assert.equal(accentFromRgb(128, 128, 128).sat, 0);
const red = rgbToOklch(255, 0, 0);
assert.ok(red.h >= 25 && red.h <= 35, `red hue ${red.h}`);
assert.ok(accentFromRgb(255, 0, 0).sat > 1);
assert.ok(accentFromRgb(0, 0, 0).lit >= 0.7, "lit is raised to bleh's minimum");
assert.ok(accentFromRgb(255, 255, 255).sat <= 4, "sat is clamped like clamp_sat");

assert.equal(cssUrl('url("https://x/a b.jpg")'), "https://x/a b.jpg");
assert.equal(cssUrl("url(data:image/png;base64,AAA)"), "data:image/png;base64,AAA");
assert.equal(cssUrl("none"), null);
assert.equal(cssUrl(null), null);

for (const t of THEMES) assert.match(t.id, /^[a-z_]+$/);
assert.ok(THEMES.some((t) => t.type === "light") && THEMES.some((t) => t.type === "dark"));

// "adapt to my device": light OS → day theme, dark OS → night theme
assert.equal(effectiveTheme({ ...DEFAULTS, theme: "oled" }), "oled");
(globalThis as any).__dark = false;
assert.equal(effectiveTheme({ ...DEFAULTS, theme_schedule: true, theme_day: "ink", theme_night: "oled" }), "ink");

// sanitize: right keys + right types only, numbers clamped, enums checked, text bounded
const clean = sanitize({ hue: 999, sat: "x", banner: "false", theme: "nope", font_choice: "hyperlegible", bannerUrl: null, constructor: 1, __proto__: { x: 1 }, font: "a".repeat(500), noise: NaN });
assert.deepEqual(Object.keys(clean).sort(), ["font", "font_choice", "hue"]);
assert.equal(clean.hue, 360);
assert.equal(clean.font!.length, 200);
assert.deepEqual(sanitize("nope"), {});
assert.deepEqual(sanitize([1]), {});

// seasons: bleh's dates
assert.equal(seasonState(new Date(2026, 11, 25)).current?.id, "christmas");
assert.equal(seasonState(new Date(2026, 9, 31, 23, 0)).current?.id, "halloween");
assert.equal(seasonState(new Date(2026, 2, 1)).current, undefined);
assert.equal(seasonState(new Date(2026, 2, 1)).next.id, "easter");
assert.equal(seasonState(new Date(2026, 11, 31, 23, 59, 59)).current?.id, "christmas");
assert.equal(seasonState(new Date(2026, 0, 3)).current?.id, "new_years");
assert.equal(SEASONS.length, 8);

// quick switcher scoring: prefix > word start > substring > scattered letters > none; accents folded
assert.ok(score("sub", "Subjects") > score("sub", "My subjects"));
assert.ok(score("sub", "My subjects") > score("sub", "Resubmit"));
assert.ok(score("sbj", "Subjects") > 0);
assert.equal(score("xyz", "Subjects"), 0);
assert.ok(score("diseno", "Diseño de interfaces") > 0);

// leftover sweep: light surfaces / dark ink / light borders get tagged, our own dark oklch surfaces don't
assert.ok(lightness("rgb(255, 255, 255)")!.l > 0.999);
assert.equal(lightness("rgba(0, 0, 0, 0)")!.a, 0);
assert.equal(lightness("oklch(0.2 0.01 298 / 0.72)")!.l, 0.2);
const cs = (bg: string, bd: string, w: string, tx: string) => ({ backgroundColor: bg, borderTopColor: bd, borderTopWidth: w, color: tx });
assert.equal(tagsFor(cs("rgb(255, 255, 255)", "rgb(240, 240, 240)", "1px", "rgb(85, 85, 85)")), "bg tx bd");
assert.equal(tagsFor(cs("rgba(0, 0, 0, 0)", "rgb(240, 240, 240)", "0px", "oklch(0.85 0.012 298)")), "");
assert.equal(tagsFor(cs("oklch(0.2 0.014 298 / 0.72)", "rgb(0, 0, 0)", "1px", "rgb(66, 168, 199)")), "");
assert.equal(tagsFor(cs("rgb(248, 249, 250)", "rgba(0, 0, 0, 0)", "0px", "rgb(33, 37, 41)")), "bg tx");
// updater: dotted versions compare numerically, metadata block parsed
assert.ok(isNewer("0.10.0", "0.9.9") && isNewer("1.0", "0.9.9") && !isNewer("0.5.0", "0.5.0") && !isNewer("0.4.9", "0.5.0"));
assert.equal(parseVersion("// ==UserScript==\n// @name x\n// @version      0.5.0\n// ==/UserScript=="), "0.5.0");

// preview: type decides, extension only when the server says nothing useful; pages and Office files are left alone
assert.equal(kindFor("application/pdf; charset=x", "/a"), "pdf");
assert.equal(kindFor("image/png", "/a"), "image");
assert.equal(kindFor("application/octet-stream", "/pluginfile.php/1/mod_resource/content/1/a.PDF"), "pdf");
assert.equal(kindFor("text/html", "/mod/resource/view.php"), undefined);
assert.equal(kindFor("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "/a.docx"), "docx");
assert.equal(kindFor("application/octet-stream", "/a.XLSX"), "xlsx");
assert.equal(kindFor("text/x-python", "/a.py"), "text");
assert.equal(kindFor("application/octet-stream", "/q.sql"), "text");
assert.equal(kindFor("text/html", "/a.docx"), undefined);
assert.equal(kindFor("application/x-rar", "/a.rar"), undefined);
{ const { parseCsv } = await import("./src/office"); assert.deepEqual(parseCsv('a;b\n"x;1";"he said ""hi"""\r\n'), [["a", "b"], ["x;1", 'he said "hi"']]); }
const O = "https://x.test";
assert.ok(isFileLink(new URL(`${O}/mod/resource/view.php?id=3`), O));
assert.ok(!isFileLink(new URL(`${O}/mod/resource/view.php`), O));
assert.ok(isFileLink(new URL(`${O}/pluginfile.php/1/mod_resource/content/1/a.png`), O));
assert.ok(isFileLink(new URL(`${O}/pluginfile.php/1/a.png?forcedownload=1`), O) && isFileLink(new URL(`${O}/pluginfile.php/1/a.docx`), O) && !isFileLink(new URL(`${O}/pluginfile.php/1/a.rar`), O));
assert.ok(!isFileLink(new URL("https://other.test/mod/resource/view.php?id=3"), O));

// section list: neighbours of the active entry
assert.deepEqual(neighbours([{ active: false }, { active: true }, { active: false }]), { prev: 0, next: 2 });
assert.deepEqual(neighbours([{ active: true }, { active: false }]), { prev: undefined, next: 1 });
assert.deepEqual(neighbours([{ active: false }]), {});
console.log("ok");

// dashboard / course extras
{
	const now = Date.UTC(2026, 9, 20, 12) / 1000;
	assert.equal(bucket(now - 60, now), "Overdue");
	assert.equal(bucket(now + 86400 * 10, now), "Later");
	assert.ok(["Today", "Tomorrow"].includes(bucket(now + 600, now)));
	const v = (url: string) => ({ url, title: url, sub: "", at: 0 });
	assert.deepEqual(pushVisit([v("a"), v("b")], v("b")).map((x) => x.url), ["b", "a"]);
	assert.equal(pushVisit([v("a"), v("b"), v("c")], v("d"), 3).length, 3);
	assert.deepEqual(unseen(undefined, [1, 2]), []);
	assert.deepEqual(unseen([1], [1, 2, 3]), [2, 3]);
	assert.equal(step(-1, 1, 3), 0); assert.equal(step(-1, -1, 3), 2); assert.equal(step(2, 1, 3), 2); assert.equal(step(0, -1, 3), 0); assert.equal(step(-1, 1, 0), -1);
	assert.ok(Object.keys(GO).every((k) => k.length === 1 && GO[k][1].startsWith("/")));
}
console.log("extras ok");

{
	const o = "https://x.test";
	assert.ok(isActivityLink(new URL(o + "/mod/assign/view.php?id=5"), o));
	assert.ok(!isActivityLink(new URL(o + "/mod/quiz/view.php?id=5"), o));
	assert.ok(!isActivityLink(new URL(o + "/mod/resource/view.php?id=5"), o));
	assert.ok(!isActivityLink(new URL("https://evil.test/mod/assign/view.php?id=5"), o));
	assert.ok(isFresh(1000, 5000) && !isFresh(1000, 1000 + 3 * 60e3) && !isFresh(5000, 1000));
	assert.equal(burst(1000, 800, 200, 20, () => 0.5).length, 20);
}
console.log("popout/celebrate ok");

{
	assert.equal(fileKind("https://x/f/pdf-24", "")?.label, "PDF");
	assert.equal(fileKind("https://x/f/powerpoint", "Slides")?.label, "PPT");
	assert.equal(fileKind("https://x/f/unknown", "schema.sql")?.label, "SQL");
	assert.equal(fileKind("", "notes · Plain text")?.label, "TXT");
	assert.equal(fileKind("https://x/f/archive", "")?.label, "ZIP");
	assert.equal(fileKind("https://x/theme/image.php/boost/core/1/f/unknown-24", "Lecture"), undefined);
	assert.equal(fileKind("https://x/theme/image.php/boost/core/1/f/video-24", "")?.label, "VID");
	assert.equal(fileKind("https://x/f/unknown", "Lecture"), undefined);
}
console.log("filetypes ok");

{
	assert.equal(greeting(8), "Good morning"); assert.equal(greeting(15), "Good afternoon"); assert.equal(greeting(22), "Good evening"); assert.equal(greeting(3), "Good night");
	assert.equal(firstName("TOMAS PALMA SÁNCI"), "Tomas"); assert.equal(firstName("  "), "");
}
console.log("home ok");
{
	const now = Date.UTC(2026, 9, 20, 12) / 1000;
	const c = perDay([{ timesort: now }, { timesort: now + 100 }, { timesort: now + 86400 * 3 }, { timesort: now + 86400 * 9 }], now);
	assert.equal(c.length, 7); assert.equal(c[0], 2); assert.equal(c.reduce((a, b) => a + b, 0), 3);
}
{
	assert.ok(isHomePath("/my/") && isHomePath("/my/index.php") && isHomePath("/") && isHomePath("/local/docencia/actual/index.php") && isHomePath("/moodle/my/"));
	assert.ok(!isHomePath("/my/courses.php") && !isHomePath("/course/view.php") && !isHomePath("/local/docencia/historico/index.php"));
}
{
	const now = 1_000_000;
	assert.equal(courseState({ enddate: now - 1 }, now), "past"); assert.equal(courseState({ startdate: now + 5 }, now), "future"); assert.equal(courseState({ startdate: 1, enddate: 0 }, now), "inprogress");
	const list = [{ id: 1, fullname: "a", viewurl: "", enddate: now - 1 }, { id: 2, fullname: "b", viewurl: "", isfavourite: true }];
	assert.equal(inTab(list, "all", now).length, 2); assert.equal(inTab(list, "past", now).length, 1); assert.equal(inTab(list, "favourites", now)[0].id, 2); assert.equal(inTab(list, "inprogress", now)[0].id, 2);
}
