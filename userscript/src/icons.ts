import { onDomChange } from "./watch";

// bleh styles every `.icon:before` as a mask icon, which clobbers Moodle's FontAwesome `<i class="icon fa-…">`.
// Retag those as `.mf-icon` so bleh's rule no longer matches; moodle.css then draws the ones bleh has a
// counterpart for with bleh's own icon masks, and leaves the rest as the native glyph.
const retag = (roots: Element[]) => {
	for (const root of roots) {
		if (root.matches("i.icon")) { root.classList.remove("icon"); root.classList.add("mf-icon"); }
		for (const el of root.querySelectorAll("i.icon")) { el.classList.remove("icon"); el.classList.add("mf-icon"); }
	}
};

export const mountIcons = (): void => onDomChange(retag);

// bleh's menu look lives on its own item classes; give Moodle's dropdown items the same ones.
const DECORATE: [string, string][] = [
	[".dropdown-item:not(.dropdown-menu-clickable-item)", "dropdown-menu-clickable-item"],
	[".dropdown-divider:not(.sep)", "sep"],
	[".section-navigation a:not(.btn)", "btn"], // prev/next section links (course format) become bleh buttons
];
const decorate = (roots: Element[]) => {
	for (const root of roots) for (const [sel, cls] of DECORATE) {
		if (root.matches(sel)) root.classList.add(cls);
		for (const el of root.querySelectorAll(sel)) el.classList.add(cls);
	}
};
export const mountDecorate = (): void => onDomChange(decorate);
