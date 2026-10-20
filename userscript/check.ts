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
assert.equal(kindFor("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "/a.docx"), undefined);
const O = "https://x.test";
assert.ok(isFileLink(new URL(`${O}/mod/resource/view.php?id=3`), O));
assert.ok(!isFileLink(new URL(`${O}/mod/resource/view.php`), O));
assert.ok(isFileLink(new URL(`${O}/pluginfile.php/1/mod_resource/content/1/a.png`), O));
assert.ok(!isFileLink(new URL(`${O}/pluginfile.php/1/a.png?forcedownload=1`), O) && !isFileLink(new URL(`${O}/pluginfile.php/1/a.docx`), O));
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
