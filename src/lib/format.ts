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

export function formatDistanceToNow(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const diffMin = Math.round(diffMs / 60_000);
	if (diffMin < 1) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHours = Math.round(diffMin / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.round(diffHours / 24);
	if (diffDays < 7) return `${diffDays}d ago`;
	return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatEventTime(iso: string, hour12?: boolean): string {
	return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12 });
}

/** "Today", "Tomorrow", "Yesterday", else e.g. "Wed, Oct 1". */
export function formatDayLabel(iso: string): string {
	const day = new Date(iso);
	day.setHours(0, 0, 0, 0);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
	if (diff === 0) return "Today";
	if (diff === 1) return "Tomorrow";
	if (diff === -1) return "Yesterday";
	return day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Stable per-course hue (golden-angle spacing keeps neighbouring ids visually distinct). */
export function courseHue(courseId: number): number {
	return Math.round((courseId * 137.508) % 360);
}
