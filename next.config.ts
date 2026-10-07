import path from "node:path";
import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import pkg from "./package.json";
import { parseChangelog } from "./src/lib/changelog";

// Cloudflare Workers Builds sets the commit sha; a redeploy of the same version still counts as an update.
const build = process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7);

// Parsed at build time and inlined: the Worker has no filesystem to read CHANGELOG.md from at runtime.
const releases = parseChangelog(readFileSync(path.resolve(__dirname, "CHANGELOG.md"), "utf8"));

const nextConfig: NextConfig = {
	devIndicators: false,
	env: {
		NEXT_PUBLIC_APP_VERSION: pkg.version,
		NEXT_PUBLIC_RELEASES: JSON.stringify(releases),
		NEXT_PUBLIC_BUILD_ID: build ? `${pkg.version}+${build}` : pkg.version,
		NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
	},
	turbopack: {
		root: path.resolve(__dirname),
	},
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
