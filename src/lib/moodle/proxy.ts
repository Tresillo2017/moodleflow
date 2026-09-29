/** Web service paths the CORS proxy may forward. Everything else is refused. */
const ALLOWED_PATHS = [
	/^webservice\/rest\/server\.php$/,
	/^webservice\/upload\.php$/,
	/^webservice\/pluginfile\.php\/.+/,
	/^login\/token\.php$/,
];

export const isProxiedPath = (path: string) => ALLOWED_PATHS.some((re) => re.test(path));

const LOCAL_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home.arpa"];

/**
 * Validates the site the proxy is asked to talk to and returns its origin, or null.
 * Guards against the proxy being used to reach anything but public HTTPS Moodle sites (SSRF).
 */
export function parseProxyTarget(site: string | null): string | null {
	if (!site) return null;
	let url: URL;
	try {
		url = new URL(site);
	} catch {
		return null;
	}
	const host = url.hostname.toLowerCase();
	const isIpLiteral = host.includes(":") || /^[\d.]+$/.test(host);
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.port ||
		isIpLiteral ||
		!host.includes(".") ||
		LOCAL_SUFFIXES.some((s) => host.endsWith(s))
	) {
		return null;
	}
	return url.origin;
}

/**
 * Optional deployment allowlist (comma-separated hostnames, e.g. "moodle.school.edu,learn.uni.edu").
 * Empty or unset means any public HTTPS Moodle site is allowed.
 */
export function isHostAllowed(origin: string, allowlist: string | undefined): boolean {
	const hosts = (allowlist ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
	return hosts.length === 0 || hosts.includes(new URL(origin).hostname);
}
