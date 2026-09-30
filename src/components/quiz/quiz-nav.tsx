import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizNavItem, QuizQuestionState } from "@/types/quiz";

const STATE_STYLE: Record<QuizQuestionState, string> = {
	todo: "bg-transparent text-muted-foreground",
	complete: "border-primary/40 bg-primary/15 text-foreground",
	correct: "border-success/50 bg-success/15 text-foreground",
	partial: "border-warning/50 bg-warning/15 text-foreground",
	incorrect: "border-danger/50 bg-danger/15 text-foreground",
	gaveup: "bg-muted text-muted-foreground",
	needsgrading: "border-warning/50 bg-transparent text-foreground",
	other: "bg-transparent text-muted-foreground",
};

interface QuizNavProps {
	items: QuizNavItem[];
	/** Page being viewed (attempt mode); its questions get a ring. */
	activePage?: number;
	onSelect: (item: QuizNavItem) => void;
	disabled?: boolean;
}

/** Numbered question buttons coloured by state, with a flag marker. */
export function QuizNav({ items, activePage, onSelect, disabled }: QuizNavProps) {
	const numbered = items.filter((i) => i.answerable);
	return (
		<nav aria-label="Quiz navigation" className="rounded-xl border bg-card p-3">
			<ul className="grid grid-cols-5 gap-1.5">
				{numbered.map((item) => (
					<li key={item.slot}>
						<button
							type="button"
							disabled={disabled}
							onClick={() => onSelect(item)}
							aria-label={`Question ${item.number}${item.statusLabel ? `, ${item.statusLabel}` : ""}${item.flagged ? ", flagged" : ""}`}
							aria-current={activePage === item.page ? "step" : undefined}
							className={cn(
								"relative flex h-8 w-full items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
								STATE_STYLE[item.state],
								!disabled && "hover:border-foreground/40",
								activePage === item.page && "ring-2 ring-primary/60",
							)}
						>
							{item.number}
							{item.flagged && <Flag className="absolute -top-1 -right-1 size-3 fill-warning text-warning" aria-hidden="true" />}
						</button>
					</li>
				))}
			</ul>
		</nav>
	);
}
