// bleh's fonts.css @imports ~11 Google Fonts stylesheets on every page; build.mjs removes them and this loads just the
// families the current settings use, as one <link> (display=swap, so text never waits for it).
import * as settings from "./settings";

const FAMILY = {
	base: "family=Hanken+Grotesk:ital,wght@0,100..900;1,100..900&family=Instrument+Serif:ital@0;1",
	font_2025: "family=Funnel+Sans:ital,wght@0,300..800;1,300..800",
	hyperlegible: "family=Atkinson+Hyperlegible+Next:ital,wght@0,200..800;1,200..800",
	emoji: "family=Noto+Color+Emoji",
	// the decorative faces bleh's seasons use for headings
	season: "family=Balsamiq+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Cherry+Bomb+One&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Lilita+One&family=Rokkitt:ital,wght@0,100..900;1,100..900&family=Rakkas&family=Single+Day&family=UnifrakturCook:wght@700",
};

let link: HTMLLinkElement | undefined;
let loaded = "";

export function loadFonts(): void {
	const s = settings.get();
	const parts = [FAMILY.base];
	if (s.font_choice === "font_2025") parts.push(FAMILY.font_2025);
	if (s.font_choice === "hyperlegible") parts.push(FAMILY.hyperlegible);
	if (s.font_emoji) parts.push(FAMILY.emoji);
	if (document.body?.hasAttribute("data-bleh--season")) parts.push(FAMILY.season);
	const url = `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
	if (url === loaded) return;
	loaded = url;
	if (!link) {
		for (const [rel, href, cors] of [["preconnect", "https://fonts.googleapis.com", false], ["preconnect", "https://fonts.gstatic.com", true]] as const) {
			const pc = document.createElement("link");
			pc.rel = rel; pc.href = href;
			if (cors) pc.crossOrigin = "";
			document.head.append(pc);
		}
		link = document.createElement("link");
		link.rel = "stylesheet";
		document.head.append(link);
	}
	link.href = url;
}
