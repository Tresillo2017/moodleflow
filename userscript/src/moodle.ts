// Reads what bleh's shell needs out of Moodle's (Boost 4.x/5.x) DOM. Read-only: nothing here mutates the page.
export type Link = { label: string; href: string; active: boolean; key?: string };

const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const qa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";

const toLinks = (anchors: HTMLAnchorElement[]): Link[] =>
	anchors.map((a) => ({
		label: text(a),
		href: a.href,
		active: a.classList.contains("active") || a.getAttribute("aria-current") === "true" || a.classList.contains("active_tree_node"),
		key: a.closest<HTMLElement>("[data-key]")?.dataset.key,
	})).filter((l) => l.label && l.href && !l.href.endsWith("#"));

/** Primary navigation: Home / Dashboard / My courses / site admin … */
const NAV = (area: string) => `${area} .moremenu .nav-link[href]:not([data-toggle]):not([data-bs-toggle]), ${area} .moremenu .dropdown-menu a.dropdown-item[href]`;
/** Nav links plus the children of "More ▾" style dropdowns (flattened, deduplicated by href). */
const navLinks = (area: string): Link[] => {
	const seen = new Set<string>();
	return toLinks(qa<HTMLAnchorElement>(NAV(area))).filter((l) => !seen.has(l.href) && !!seen.add(l.href));
};
/** Alexia "classroom" theme: its own second navbar, with "Teaching ▾" / "Resources ▾" dropdown groups. */
const classroomLinks = (): Link[] => {
	const seen = new Set<string>();
	const links = toLinks(qa<HTMLAnchorElement>("#classroom-navbar-secondary ul.nav-tabs a[href]")).filter((l) => !seen.has(l.href) && !!seen.add(l.href));
	const keyFor = (path: string) => /\/historico\//.test(path) ? "history" : /\/ofertas\//.test(path) ? "offers" : /\/docencia\//.test(path) ? "mycourses" : /calendar/.test(path) ? "calendar" : /user\/files/.test(path) ? "files" : undefined;
	return links.map((l) => ({ ...l, active: new URL(l.href).pathname === location.pathname, key: keyFor(new URL(l.href).pathname) }));
};
export const primaryLinks = (): Link[] => {
	const stock = navLinks(".primary-navigation");
	return stock.length ? stock : classroomLinks();
};

/** Secondary navigation: the course tabs (Course / Participants / Grades …). */
export const secondaryLinks = (): Link[] => navLinks(".secondary-navigation");

export const siteName = (): string => text(q(".navbar-brand")) || document.title.split("|").pop()?.trim() || "Moodle";
export const siteLogo = (): string | null => q<HTMLImageElement>(".navbar-brand img, #classroom-navbar-secondary .brand-logo img")?.src ?? null;

/** The page's own heading, minus the site name Moodle appends to <title>. */
export function pageTitle(): string {
	const h = q(".page-context-header h1, #page-header h1, .page-header-headings h1");
	if (text(h)) return text(h);
	return document.title.split("|")[0].trim();
}

/** Small label above the title, like bleh's "Album" / "Artist". */
export function pageLabel(): string {
	const crumbs = qa(".breadcrumb-item", document).map(text).filter(Boolean);
	if (crumbs.length > 1) return crumbs[crumbs.length - 2];
	return crumbs.length === 1 ? "" : text(q(".breadcrumb-item"));
}

export type User = { name: string; avatar: string | null; href: string | null };
export function currentUser(): User | null {
	const btn = q("#user-menu-toggle, .usermenu .dropdown-toggle");
	if (!btn) return null;
	const img = q<HTMLImageElement>("img", btn);
	const name = text(q(".usertext", btn)) || img?.alt || btn.getAttribute("aria-label") || "";
	const href = qa<HTMLAnchorElement>("#user-action-menu a[href*='user/profile.php']")[0]?.href ?? null;
	return { name, avatar: img?.src ?? null, href };
}

export const isLoggedIn = (): boolean => !document.body.classList.contains("notloggedin");
export const courseId = (): string | null => {
	const id = document.body.className.match(/(?:^|\s)course-(\d+)(?:\s|$)/)?.[1];
	return id && id !== "1" ? id : null;
};
