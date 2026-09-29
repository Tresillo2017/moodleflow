import DOMPurify from "dompurify";

const PLUGINFILE_PLACEHOLDER = /@@PLUGINFILE@@/g;

export interface SanitizeOptions {
	/** Adds the auth token to Moodle file URLs (client.fileUrl); must only touch the Moodle host. */
	fileUrl?: (url: string) => string;
	/** Where `@@PLUGINFILE@@` points for this content, e.g. https://site/webservice/pluginfile.php/<ctx>/<component>/<area>/<item> */
	pluginfileBase?: string;
}

/**
 * Sanitises teacher-written Moodle HTML: strips scripts and handlers, opens links in a new tab,
 * lets the theme choose colours, and gives pluginfile URLs the user's token.
 * ponytail: drops intentional colours too; keep only high-contrast ones if that matters.
 */
export function sanitizeMoodleHtml(html: string, { fileUrl, pluginfileBase }: SanitizeOptions = {}): string {
	const purify = DOMPurify();
	purify.addHook("afterSanitizeAttributes", (node) => {
		node.removeAttribute("color");
		node.removeAttribute("bgcolor");
		if (node instanceof HTMLElement) {
			for (const property of ["color", "background", "background-color", "background-image"]) {
				node.style.removeProperty(property);
			}
			if (node.getAttribute("style") === "") node.removeAttribute("style");
		}
		if (node.tagName === "A") {
			node.setAttribute("target", "_blank");
			node.setAttribute("rel", "noopener noreferrer");
		}
		for (const attr of ["src", "href"]) {
			const value = node.getAttribute(attr);
			if (fileUrl && value?.includes("/pluginfile.php/")) {
				const withWebservice = value.replace(/(?<!\/webservice)\/pluginfile\.php\//, "/webservice/pluginfile.php/");
				node.setAttribute(attr, fileUrl(withWebservice));
			}
		}
	});
	// Forms could post the user's input to a third party; drop them (and their controls) entirely.
	return purify.sanitize(pluginfileBase ? html.replace(PLUGINFILE_PLACEHOLDER, pluginfileBase) : html, {
		FORBID_TAGS: ["form", "input", "button", "select", "textarea"],
		FORBID_ATTR: ["action", "formaction"],
	});
}
