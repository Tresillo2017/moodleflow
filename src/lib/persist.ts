/**
 * localStorage plus, for non-sensitive keys only, a year-long cookie mirror so settings survive
 * storage clearing. Cookies are sent with every request to this origin, so credentials
 * (the Moodle token) must never be passed with `mirror: true`.
 */
const YEAR = 60 * 60 * 24 * 365;

export function readPersisted(key: string, mirror = false): string | null {
	try {
		const local = window.localStorage.getItem(key);
		if (local !== null) return local;
	} catch {
		// blocked: fall through to the cookie
	}
	if (!mirror) return null;
	const match = document.cookie.split("; ").find((c) => c.startsWith(`${key}=`));
	if (!match) return null;
	const value = decodeURIComponent(match.slice(key.length + 1));
	try {
		window.localStorage.setItem(key, value); // restore what was cleared
	} catch {}
	return value;
}

export function writePersisted(key: string, value: string, mirror = false): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// cookie still holds it
	}
	void navigator.storage?.persist?.();
	if (!mirror) return;
	const secure = location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${key}=${encodeURIComponent(value)}; Max-Age=${YEAR}; Path=/; SameSite=Lax${secure}`;
}

export function removePersisted(key: string): void {
	try {
		window.localStorage.removeItem(key);
	} catch {}
	document.cookie = `${key}=; Max-Age=0; Path=/`;
}
