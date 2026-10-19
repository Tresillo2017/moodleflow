// tiny element builder shared by the shell and the settings page
export type Kid = Node | string | null | undefined | false;
export function h<K extends keyof HTMLElementTagNameMap>(
	tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
	el.append(...(kids.filter(Boolean) as (Node | string)[]));
	return el;
}
