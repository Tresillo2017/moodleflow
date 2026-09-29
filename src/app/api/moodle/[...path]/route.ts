import { isHostAllowed, isProxiedPath, parseProxyTarget } from "@/lib/moodle/proxy";

// Opt-in CORS proxy for Moodle sites that don't send CORS headers. It forwards only web service
// endpoints to the public HTTPS site named in `moodle_site`, drops cookies, and stores nothing.
export const dynamic = "force-dynamic";

const FORWARD_REQUEST = ["content-type", "range", "accept"];
const FORWARD_RESPONSE = ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition"];

const ACTIVE_CONTENT = /^\s*(text\/html|application\/xhtml\+xml|image\/svg\+xml|(application|text)\/xml)\b/i;

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
	const rel = (await params).path.join("/");
	if (!isProxiedPath(rel) || rel.split("/").some((part) => part === "..")) {
		return Response.json({ error: "Path not allowed" }, { status: 404 });
	}

	const incoming = new URL(req.url);
	const origin = parseProxyTarget(incoming.searchParams.get("moodle_site"));
	if (!origin) return Response.json({ error: "Invalid Moodle site" }, { status: 400 });
	if (!isHostAllowed(origin, process.env.MOODLE_PROXY_ALLOWED_HOSTS)) {
		return Response.json({ error: "This Moodle site isn't allowed on this deployment" }, { status: 403 });
	}
	incoming.searchParams.delete("moodle_site");

	const target = new URL(`/${rel}`, origin);
	target.search = incoming.search;

	const headers = new Headers();
	for (const name of FORWARD_REQUEST) {
		const value = req.headers.get(name);
		if (value) headers.set(name, value);
	}

	const hasBody = req.method !== "GET" && req.method !== "HEAD";
	let upstream: Response;
	try {
		// redirect: "manual" so a hostile site can't bounce the proxy to another host
		upstream = await fetch(target, {
			method: req.method,
			headers,
			body: hasBody ? req.body : undefined,
			redirect: "manual",
			...(hasBody && { duplex: "half" }),
		} as RequestInit);
	} catch {
		return Response.json({ error: "Couldn't reach the Moodle site" }, { status: 502 });
	}
	if (upstream.status >= 300 && upstream.status < 400) {
		return Response.json({ error: "Moodle redirected the request" }, { status: 502 });
	}

	const out = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
	for (const name of FORWARD_RESPONSE) {
		const value = upstream.headers.get(name);
		if (value) out.set(name, value);
	}
	// Files are attacker-controlled and served from our origin: never let HTML/SVG/XML run here.
	if (ACTIVE_CONTENT.test(out.get("content-type") ?? "")) {
		out.set("Content-Disposition", "attachment");
		out.set("Content-Security-Policy", "sandbox; default-src 'none'");
	}
	return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as HEAD };
