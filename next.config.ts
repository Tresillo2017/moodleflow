import path from "node:path";
import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
	env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
	turbopack: {
		root: path.resolve(__dirname),
	},
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
