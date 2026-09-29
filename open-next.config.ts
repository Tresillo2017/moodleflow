import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// `bun run build` is OpenNext's build (Cloudflare's CI runs it, then `wrangler deploy`), so point it at
// the real Next build to avoid it re-running itself.
export default {
	...defineCloudflareConfig({
		// Uncomment to enable R2 cache,
		// It should be imported as:
		// `import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";`
		// See https://opennext.js.org/cloudflare/caching for more details
		// incrementalCache: r2IncrementalCache,
	}),
	buildCommand: "next build",
};
