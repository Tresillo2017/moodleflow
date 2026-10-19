// One MutationObserver for the whole script. Handlers receive only the elements added since the last run (outermost
// ones, deduplicated), so a burst of AJAX rendering costs O(new nodes), not O(page) per handler per frame.
type Handler = (added: Element[]) => void;
const handlers = new Set<Handler>();
let pending = new Set<Element>();
let queued = false;
let started = false;

function flush(): void {
	queued = false;
	const batch = [...pending].filter((el) => el.isConnected && ![...pending].some((o) => o !== el && o.contains(el)));
	pending = new Set();
	if (batch.length) handlers.forEach((h) => h(batch));
}

/** Registers `fn`; with `runNow` it first gets the whole body once. */
export function onDomChange(fn: Handler, runNow = true): void {
	handlers.add(fn);
	if (runNow) fn([document.body]);
	if (started) return;
	started = true;
	new MutationObserver((records) => {
		for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && pending.add(n));
		if (pending.size && !queued) { queued = true; requestAnimationFrame(flush); }
	}).observe(document.body, { childList: true, subtree: true });
}
