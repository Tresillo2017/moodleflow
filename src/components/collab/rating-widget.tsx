"use client";

import { Star } from "lucide-react";
import { toast } from "@/lib/toast";
import type { ItemRating } from "@/types/collab";

/** Shows an item's rating summary and, where allowed, lets the user rate it. `onRate` performs the save. */
export function RatingWidget({ rating, label, onRate }: { rating: ItemRating | undefined; label: string; onRate: (value: number) => Promise<void> }) {
	if (!rating || (!rating.canRate && !rating.aggregate)) return null;
	return (
		<span className="flex items-center gap-2 text-xs text-muted-foreground">
			<Star className="size-3.5" aria-hidden="true" />
			{rating.aggregate && <span>{rating.aggregate}</span>}
			{rating.canRate && (
				<select
					aria-label={label}
					value={rating.mine ?? ""}
					onChange={(e) => {
						if (!e.target.value) return;
						onRate(Number(e.target.value)).catch(() => toast.error("Couldn't save your rating."));
					}}
					className="h-6 rounded-md border bg-background px-1"
				>
					<option value="">Rate…</option>
					{rating.options.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			)}
		</span>
	);
}
