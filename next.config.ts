import path from "node:path";
import type { NextConfig } from "next";
import pkg from "./package.json";

// Cloudflare Workers Builds sets the commit sha; a redeploy of the same version still counts as an update.
const build = process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7);

const nextConfig: NextConfig = {
	env: {
		NEXT_PUBLIC_APP_VERSION: pkg.version,
		NEXT_PUBLIC_BUILD_ID: build ? `${pkg.version}+${build}` : pkg.version,
	},
	turbopack: {
		root: path.resolve(__dirname),
	},
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
