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

export type Zone = "hero" | "main" | "side";
/** The dashboard's own layout skeleton (hero strip, main column, side column), created once at the top of the main region.
 *  `null` away from the dashboard and in edit mode (Moodle's own blocks stay untouched there). */
export function homeSlot(zone: Zone = "main"): HTMLElement | null {
	if (!isDashboard() || document.body.classList.contains("editing")) return null;
	let root = document.querySelector<HTMLElement>(".mf-home");
	if (!root) {
		const main = document.querySelector("#region-main");
		if (!main) return null;
		root = document.createElement("div");
		root.className = "mf-home";
		for (const z of ["hero", "main", "side"]) { const el = document.createElement("div"); el.className = `mf-home-${z}`; root.append(el); }
		main.prepend(root);
	}
	return root.querySelector<HTMLElement>(`.mf-home-${zone}`);
}
