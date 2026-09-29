import { ListSkeleton } from "@/components/ui/state";

export default function DashboardLoading() {
	return (
		<div className="flex flex-col gap-8">
			<div className="h-36 animate-pulse rounded-xl border bg-muted/40" />
			<ListSkeleton rows={3} />
		</div>
	);
}
