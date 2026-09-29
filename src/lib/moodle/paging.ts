const MAX_PAGES = 100;

/**
 * Collects every item from a paged Moodle function. `fetchPage(page)` returns one page (0-based);
 * a page shorter than `pageSize` is the last. For limitfrom/limitnum APIs use `page * pageSize` as limitfrom.
 */
export async function fetchAllPages<T>(fetchPage: (page: number) => Promise<T[]>, pageSize: number): Promise<T[]> {
	const all: T[] = [];
	for (let page = 0; page < MAX_PAGES; page++) {
		const items = await fetchPage(page);
		all.push(...items);
		if (items.length < pageSize) break;
	}
	return all;
}
