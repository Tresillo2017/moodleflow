export function formatRelativeDue(iso: string): { label: string; overdue: boolean; soon: boolean } {
	const due = new Date(iso).getTime();
	const diffMs = due - Date.now();
	const diffDays = Math.round(diffMs / 86_400_000);

	if (diffDays < 0) {
		return { label: `Overdue by ${Math.abs(diffDays)}d`, overdue: true, soon: false };
	}
	if (diffDays === 0) return { label: "Due today", overdue: false, soon: true };
	if (diffDays === 1) return { label: "Due tomorrow", overdue: false, soon: true };
	if (diffDays <= 3) return { label: `Due in ${diffDays}d`, overdue: false, soon: true };
	return {
		label: `Due ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
		overdue: false,
		soon: false,
	};
}

export function formatEventTime(iso: string): string {
	return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
