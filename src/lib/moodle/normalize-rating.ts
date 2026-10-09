import type { ItemRating } from "@/types/collab";
import { asArray, asRecord } from "./normalize";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** Rating widgets by item id, from the `ratinginfo` block that forum threads, glossaries and databases carry. */
export function normalizeRatings(raw: unknown): Map<number, ItemRating> {
	const info = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
	const scales = asArray(info.scales).map(asRecord);
	const out = new Map<number, ItemRating>();
	for (const entry of asArray(info.ratings).map(asRecord)) {
		const scaleId = Number(entry.scaleid);
		const scale = scales.find((s) => Number(s.id) === scaleId);
		const items = asArray(scale?.scaleitems).map(asRecord);
		const max = Number(scale?.max ?? 0);
		const options = items.length
			? items.map((i) => ({ value: Number(i.value), label: String(i.name ?? i.value) }))
			: Array.from({ length: max }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
		if (!options.length) continue;
		const mine = entry.rating === undefined || entry.rating === null || entry.rating === "" ? undefined : Number(entry.rating);
		out.set(Number(entry.itemid), {
			scaleId,
			options,
			canRate: Boolean(entry.canrate),
			mine: mine && mine > 0 ? mine : undefined,
			aggregate: entry.canviewaggregate === false ? undefined : str(entry.aggregatestr),
			count: Number(entry.count ?? 0),
		});
	}
	return out;
}
