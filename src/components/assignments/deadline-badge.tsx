import { Badge } from "@/components/ui/badge";
import { formatRelativeDue } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DeadlineBadge({ dueDate }: { dueDate?: string }) {
	if (!dueDate) return null;
	const { label, overdue, soon } = formatRelativeDue(dueDate);
	return (
		<Badge
			variant="outline"
			className={cn(
				"font-normal",
				overdue && "border-danger/30 bg-danger/10 text-danger",
				soon && !overdue && "border-warning/30 bg-warning/10 text-warning-foreground",
			)}
		>
			{label}
		</Badge>
	);
}
