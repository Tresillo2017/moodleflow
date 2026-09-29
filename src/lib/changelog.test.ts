import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseChangelog } from "./changelog";
import pkg from "../../package.json";

describe("parseChangelog", () => {
	it("parses releases, groups and items, skipping empty ones", () => {
		const md = "# Changelog\n## [Unreleased]\n## [1.2.0] - 2026-01-02\n### Added\n- One\n- Two\n### Fixed\n- Three\n";
		expect(parseChangelog(md)).toEqual([
			{ version: "1.2.0", date: "2026-01-02", groups: [{ title: "Added", items: ["One", "Two"] }, { title: "Fixed", items: ["Three"] }] },
		]);
	});

	it("has the package.json version as its newest release", () => {
		const releases = parseChangelog(readFileSync("CHANGELOG.md", "utf8"));
		expect(releases[0].version).toBe(pkg.version);
	});
});
