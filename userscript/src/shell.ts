// Builds bleh's page shell (masthead, page header, tab row, one big card with main + sidebar columns) using
// bleh's own class names, so its stylesheets apply untouched. Moodle's live elements (notification/message
// popovers, user menu, #region-main, blocks) are moved into the shell rather than re-implemented, so Moodle's
// own JS keeps working on them.
import * as m from "./moodle";
import { onDomChange } from "./watch";
import { TABS, sideColumn, buildAll, showTab, syncSettingsControls, mountSettingsControls } from "./settings-page";

import { h } from "./dom";
import * as settings from "./settings";
const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);

/** Icon name → bleh's mask variable, applied through the `--mask` hook its buttons/tabs read. */
const icon = (name: string) => `--mask: var(--icon-16-${name})`;

const TAB_ICONS: Record<string, string> = {
	// secondary navigation (course tabs)
	coursehome: "home", participants: "users", grades: "chart-bar", competencies: "listening-report", editsettings: "settings",
	coursereports: "chart-line", questionbank: "question", contentbank: "library", coursecompletion: "checks", badgesview: "obsession",
	filtermanagement: "advanced", coursetools: "app", coursereuse: "copy", enrolments: "user-plus", more: "dots",
	// primary navigation
	history: "recent", offers: "labs", files: "library", home: "home", myhome: "layout-manage", mycourses: "library", calendar: "calendar", sitesettings: "advanced",
};

function mastheadLink(label: string, href: string, key: string | undefined, active: boolean): HTMLElement {
	const a = h("a", { class: "btn masthead-nav-control icon", href, "data-type": key ?? "link", style: icon(TAB_ICONS[key ?? ""] ?? "dot") }, label);
	if (active) a.setAttribute("aria-current", "page");
	return a;
}

function buildMasthead(): HTMLElement {
	const logo = m.siteLogo();
	const home = h("a", { class: "btn navigation-item home-link", href: location.origin + "/" },
		h("span", { class: "home-logo-container" }, logo && settings.get().branding_type === "logo" ? h("img", { src: logo, alt: "" }) : m.siteName()));
	const nav = h("nav", { class: "navlist navlist--more masthead-nav masthead-nav-top" },
		h("ul", { class: "navlist-items" }, ...m.primaryLinks().map((l) => mastheadLink(l.label, l.href, l.key, l.active))));

	// global search is off by default in Moodle: only offer it when the stock navbar had a search field
	const search = q("#searchinput-navbar, nav.navbar .simplesearchform input[type=text], #classroom-navbar .simplesearchform input[type=text]");
	const searchForm = !search ? null : h("form", { class: "masthead-search-form", action: search?.closest("form")?.action || location.origin + "/search/index.php", method: "get" },
		h("input", { class: "masthead-search-field", name: "q", placeholder: search?.getAttribute("aria-label") ?? "Search", type: "text" }),
		h("button", { class: "masthead-search-submit btn chibi icon-mask", type: "submit", "data-type": "search", "aria-label": "Search" }));

	const controls = h("div", { class: "masthead-controls" });
	// Moodle's own popover regions keep working when moved; their toggles just become bleh buttons.
	const regions: [string, string][] = [["#nav-notification-popover-container", "notifications"], ["[data-region=popover-region-messages], .popover-region:has(a[id^=message-drawer-toggle])", "mail"], ["#nav-sede-year-popover-container", "calendar"]];
	for (const [sel, ic] of regions) {
		const el = q(sel);
		if (!el) continue;
		const toggle = q("[data-region=popover-region-toggle], .popover-region-toggle", el);
		toggle?.classList.add("btn", "masthead-nav-control", "chibi", "icon-mask");
		toggle?.setAttribute("style", icon(ic));
		el.querySelector(".count-container")?.classList.add("notification-count-badge"); // bleh's unread pill
		controls.append(el);
	}
	for (const sel of [".editmode-switch-form", ".langmenu"]) { const el = q(sel); if (el) controls.append(el); } // Moodle controls with no bleh counterpart
	const usermenu = q(".usermenu-container") ?? q(".usermenu")?.closest("li") ?? q(".usermenu");
	const user = m.currentUser();
	const auth = h("div", { class: "site-auth" });
	if (usermenu) {
		auth.append(usermenu);
		// bleh keeps its settings in the account menu; so do we (right above the divider before "Log out")
		const logout = usermenu.querySelector('a[href*="login/logout.php"]');
		const entry = h("a", { class: "dropdown-item", href: "#moodleflow/visual", role: "menuitem", id: "mf-entry" }, "moodleflow settings");
		const before = logout?.previousElementSibling?.classList.contains("dropdown-divider") ? logout.previousElementSibling : logout;
		const news = h("a", { class: "dropdown-item", href: "#", role: "menuitem", id: "mf-news" }, "What's new");
		news.onclick = (e) => { e.preventDefault(); document.dispatchEvent(new CustomEvent("moodleflow:changelog")); };
		before?.before(entry, news);
	}
	else if (!m.isLoggedIn()) auth.append(h("a", { class: "btn auth-link", href: location.origin + "/login/index.php" }, "Log in"));

	const wrap = h("div", { class: "masthead-nav-wrap" }, controls, auth);
	void user;
	// under 980px bleh swaps the bar for a bottom dock of `.mobile-control` buttons
	const mobile = (label: string, href: string, ic: string, active = false) =>
		h("a", { class: "btn mobile-control icon", href, style: icon(ic), ...(active ? { "aria-current": "page" } : {}) }, label);
	const dock = h("div", { class: "mobile-controls" },
		...m.primaryLinks().map((l) => mobile(l.label, l.href, TAB_ICONS[l.key ?? ""] ?? "dot", l.active)),
		m.isLoggedIn() ? mobile("Alerts", `${location.origin}/message/output/popup/notifications.php`, "notifications") : null,
		m.isLoggedIn() ? mobile("Messages", `${location.origin}/message/index.php`, "mail") : null,
		mobile("Settings", "#moodleflow/visual", "settings"));
	return h("header", { class: "masthead" },
		h("div", { class: "masthead-inner-wrap" }, h("div", { class: "masthead-logo" }, home, nav, searchForm), wrap), dock);
}

function buildTabs(): HTMLElement | null {
	const tabs = m.secondaryLinks();
	if (!tabs.length) return null;
	return h("nav", { class: "navlist secondary-nav redesigned-navigation", "data-theme": "" },
		h("ul", { class: "navlist-items" }, ...tabs.map((t) => h("li", { class: `navlist-item secondary-nav-item secondary-nav-item--${t.key ?? "x"}` },
			h("a", {
				class: "btn secondary-nav-item-link" + (t.active ? " secondary-nav-item-link--active" : ""),
				href: t.href, "data-type": t.key ?? "dot", style: icon(TAB_ICONS[t.key ?? ""] ?? "dot"),
			}, t.label)))));
}

function buildHeader(): HTMLElement {
	const label = m.pageLabel();
	return h("section", { class: "page-header for-home", "data-theme": "" },
		h("div", { class: "page-header-info has-main-info" },
			h("div", { class: "main-info" },
				label ? h("div", { class: "sub-text" }, label) : null,
				h("h1", { class: "page-header-title generic-page-title" }, m.pageTitle()))));
}

export const NO_SHELL_LAYOUTS = /\bpagelayout-(embedded|popup|print|frametop|maintenance|redirect|secure|login-frame)\b/;
let built = false;
/** Idempotent: safe to call again after Moodle re-renders. */
export function buildShell(): void {
	// pages without Moodle's standard content region (embedded/popup/print/secure layouts, error stubs) are left alone:
	// building the shell there would hide a page we have nothing to put back on
	if (built || !document.body || !q("#page") || !q("#region-main") || NO_SHELL_LAYOUTS.test(document.body.className)) return;
	built = true;
	document.body.classList.add("mf");

	const page = q("#page")!;
	const mainBox = q("#region-main-box") ?? q("#region-main");
	const blocks = q("#block-region-side-pre");

	const masthead = buildMasthead();
	const header = buildHeader();
	const tabs = buildTabs();

	const main = h("div", { class: "col-main in-content-view" });
	const side = h("div", { class: "col-sidebar in-content-view" });
	// bleh pads `.col-main > section` / `.col-sidebar > section`, so Moodle's content is wrapped in one section
	// and each block (already a <section>) is lifted into the sidebar; the emptied <aside> stays for Moodle's JS
	const extras = [...document.querySelectorAll<HTMLElement>("#page .classroom-actions")]; // site toolbars that live outside #region-main
	// themes (classroom) can render the activity header (description, files, "To do") in #page-header, outside #region-main
	const activityHeader = q("#page .activity-header, #page [data-for='page-activity-header']");
	if (activityHeader && !mainBox?.contains(activityHeader)) extras.push(activityHeader);
	if (mainBox) main.append(h("section", { class: "mf-moodle" }, ...extras, mainBox));
	if (blocks) for (const block of [...blocks.querySelectorAll<HTMLElement>(":scope > section.block")]) side.append(block);
	if (blocks) side.append(blocks);
	// themes can put blocks elsewhere (the classroom theme has its own right-hand region) and load some over AJAX:
	// keep lifting any block that is still in the hidden original page into the sidebar
	onDomChange(() => {
		for (const block of document.querySelectorAll<HTMLElement>("#page-wrapper section.block, #page section.block")) {
			if (!block.closest("#mf-root") && !block.closest(".modal, .drawer")) side.insertBefore(block, side.lastElementChild?.matches("aside") ? side.lastElementChild : null);
		}
		if (side.querySelector("section")) document.querySelector(".content")?.classList.remove("single-column");
	});
	const content = h("main", { class: "content" + (side.childElementCount ? "" : " single-column") },
		h("div", { class: "content-main" }, main), h("div", { class: "content-side" }, side));
	const row = h("div", { class: "row", "data-assigned": "true" }, content);
	// the same flags bleh's page.ts stamps on its container (beret + short on, lacrimosa off by default)
	const container = h("div", {
		class: "page-content container", "data-assigned": "true", "data-beret": "true", "data-short": "true", "data-lacrimosa": "false",
		"data-page-type": document.body.id || "page",
	}, header, tabs, row);
	row.setAttribute("data-lacrimosa", "false");
	content.setAttribute("data-lacrimosa", "false");

	const root = h("div", { id: "mf-root" }, masthead, container);
	document.body.prepend(root);
	// the message drawer lives inside #page in Boost; lift it out so hiding #page doesn't hide it
	const msgDrawer = q('[data-region="right-hand-drawer"]');
	if (msgDrawer) document.body.append(msgDrawer);
	// keep Moodle's footer (policies, data summary, reset tour) reachable under the card
	const footer = q("#page-footer");
	if (footer) container.append(footer);
	page.setAttribute("data-mf-hidden", "");
}

/** bleh's header cover: the course image on course pages, the photo on profiles. */
export function setHeaderAvatar(url: string | null): void {
	const header = q(".page-content > .page-header:not([data-mf-settings])");
	if (!header) return;
	header.querySelector(".page-header-avatar-list")?.remove();
	const profile = /^page-user-(profile|view)/.test(document.body.id);
	header.classList.remove("for-home", "for-profile", "for-album");
	header.classList.add(url ? (profile ? "for-profile" : "for-album") : "for-home");
	if (!url) return;
	const img = h("img", { src: url, alt: "" });
	header.prepend(h("div", { class: "page-header-avatar-list" },
		h("div", { class: "page-header-avatar colourful" }, img, h("div", { class: "page-header-avatar-glow colourful" })),
		!profile && settings.get().show_disc_image ? h("div", { class: "page-header-disc" }) : null));
}

// ---- settings mode: bleh opens its settings as a page; we swap the shell's content in place the same way ----
// Moodle's own nodes are only hidden, never detached: its AMD modules look them up by selector and throw if they vanish.
const AWAY = "data-mf-away";
let settingsTabId = "visual";
let away: HTMLElement[] = [];

function settingsToolbar(active: string): HTMLElement {
	const nav = h("nav", { class: "navlist secondary-nav navlist--more redesigned-navigation bleh-settings-navigation" },
		h("ul", { class: "navlist-items" }, ...TABS.map((t) => h("li", { class: "navlist-item secondary-nav-item" },
			h("a", { class: "btn secondary-nav-item-link bleh--nav" + (t.id === active ? " secondary-nav-item-link--active" : ""), href: `#moodleflow/${t.id}`, "data-type": t.icon, style: icon(t.icon) }, t.name)))));
	return h("div", { class: "toolbar", "data-mf-settings": "" }, nav);
}

const hide = (els: Iterable<Element>) => { for (const el of els) if (el instanceof HTMLElement && !el.hasAttribute("data-mf-settings")) { el.setAttribute(AWAY, ""); away.push(el); } };

export function openSettings(tabId = "visual"): void {
	const container = q(".page-content"), main = q(".col-main"), side = q(".col-sidebar"), row = q(".page-content > .row");
	if (!container || !main || !side || !row) return;
	settingsTabId = TABS.some((t) => t.id === tabId) ? tabId : "visual";
	const already = !!container.dataset.mfMode;
	if (!already) {
		hide(container.querySelectorAll(":scope > .page-header, :scope > .navlist"));
		hide(main.children);
		hide(side.children);
		container.dataset.mfMode = "settings";
		document.body.dataset.mfSettingsOpen = "1";
		const header = buildHeaderFor("Settings", "moodleflow");
		header.setAttribute("data-mf-settings", "");
		container.prepend(header);
		// appended directly (not wrapped): bleh's padding rules are `.col-main > section` / `.col-sidebar > section`
		const mark = (els: HTMLElement[]) => els.map((el) => { el.setAttribute("data-mf-settings", ""); return el; });
		let query = "";
		main.append(...mark([...buildAll().values()].flat()));
		side.append(...mark(sideColumn(typeof __VERSION__ === "string" ? __VERSION__ : "", (qs) => { query = qs; showTab(settingsTabId, query); })));
		q(".content")?.classList.remove("single-column");
	}
	q(".page-content .toolbar")?.remove();
	row.insertBefore(settingsToolbar(settingsTabId), q(".content")); // inside the card, like bleh
	showTab(settingsTabId);
	syncSettingsControls();
	scrollTo({ top: 0 });
}

export function closeSettings(): void {
	const container = q(".page-content");
	if (!container?.dataset.mfMode) return;
	for (const el of document.querySelectorAll("[data-mf-settings]")) el.remove();
	for (const el of away) el.removeAttribute(AWAY);
	away = [];
	delete container.dataset.mfMode;
	delete document.body.dataset.mfSettingsOpen;
	if (!q(".col-sidebar")?.childElementCount) q(".content")?.classList.add("single-column");
}

function buildHeaderFor(title: string, label: string): HTMLElement {
	return h("section", { class: "page-header for-home" }, h("div", { class: "page-header-info has-main-info" },
		h("div", { class: "main-info" }, h("div", { class: "sub-text" }, label), h("h1", { class: "page-header-title generic-page-title" }, title))));
}

/** #moodleflow/<tab> opens settings; anything else (or no hash) goes back to the Moodle page. */
export function routeSettings(): void {
	const r = location.hash.match(/^#moodleflow(?:\/(\w+))?/);
	if (r) openSettings(r[1] ?? settingsTabId);
	else closeSettings();
}
export function installSettingsRoute(): void {
	mountSettingsControls();
	addEventListener("hashchange", routeSettings);
	routeSettings();
}
