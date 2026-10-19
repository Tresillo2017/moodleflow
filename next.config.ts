import type { NextConfig } from "next";

// Static export: `next build` writes the site to ./out, which Cloudflare serves as static assets.
// Redirects (/download, /info, ...) live in public/_redirects because `redirects()` is not supported by static export.
const nextConfig: NextConfig = {
	output: "export",
	reactCompiler: true,
	turbopack: {
		root: import.meta.dirname
	},
	images: {
		unoptimized: true
	}
};

export default nextConfig;
