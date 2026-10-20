// Tiny Moodle helpers shared by the dashboard / course features: site root, session key, web-service calls and a
// JSON store on GM storage. Everything degrades to "nothing" when the page has no logged-in session.
const logout = (): HTMLAnchorElement | null => document.querySelector<HTMLAnchorElement>('a[href*="login/logout.php"]');
/** Site root without a trailing slash (Moodle may live in a sub-folder). */
export const siteRoot = (): string => logout()?.href.split("/login/logout.php")[0] ?? location.origin;
const sesskey = (): string | undefined => logout()?.href.match(/sesskey=(\w+)/)?.[1];

/** One web-service call over Moodle's ajax endpoint; resolves `null` on any failure. */
export async function call<T>(methodname: string, args: object): Promise<T | null> {
	const key = sesskey();
	if (!key) return null;
	try {
		const res = await fetch(`${siteRoot()}/lib/ajax/service.php?sesskey=${key}&info=${methodname}`, {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ index: 0, methodname, args }]),
		});
		const out = await res.json();
		return out?.[0]?.error ? null : (out?.[0]?.data ?? null);
	} catch { return null; }
}

export function read<T>(key: string, fallback: T): T {
	try { return { ...fallback, ...JSON.parse(GM_getValue(key, "{}")) }; } catch { return fallback; }
}
export const write = (key: string, value: unknown): void => { try { GM_setValue(key, JSON.stringify(value)); } catch { /* storage full */ } };

/** The dashboard (not "My courses", which shares the body id). */
export const isDashboard = (): boolean => document.body.id === "page-my-index" && !document.body.classList.contains("page-mycourses");
export const isCourseList = (): boolean => document.body.classList.contains("page-mycourses");

/** A container at the top of the dashboard's main region for the cards below to share. */
export function homeSlot(): HTMLElement | null {
	if (!isDashboard()) return null;
	let slot = document.querySelector<HTMLElement>(".mf-home");
	if (slot) return slot;
	const main = document.querySelector("#region-main");
	if (!main) return null;
	slot = document.createElement("div");
	slot.className = "mf-home";
	main.prepend(slot);
	return slot;
}
