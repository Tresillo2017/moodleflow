import { AlertTriangle, Inbox, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MoodleError } from "@/types/moodle";

export function EmptyState({
	icon: Icon = Inbox,
	title,
	description,
	action,
}: {
	icon?: React.ComponentType<{ className?: string }>;
	title: string;
	description?: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
			<Icon className="mb-2 size-8 text-muted-foreground" aria-hidden="true" />
			<p className="text-sm font-medium">{title}</p>
			{description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
			{action}
		</div>
	);
}

export function ErrorState({
	error,
	onRetry,
}: {
	error: MoodleError;
	onRetry?: () => void;
}) {
	const isNetwork = error.code === "network_error" || error.code === "site_unavailable";
	return (
		<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
			{isNetwork ? (
				<WifiOff className="mb-2 size-8 text-danger" aria-hidden="true" />
			) : (
				<AlertTriangle className="mb-2 size-8 text-danger" aria-hidden="true" />
			)}
			<p className="text-sm font-medium">
				{isNetwork ? "Moodle isn't responding" : "Something went wrong"}
			</p>
			<p className="max-w-sm text-sm text-muted-foreground">{error.message}</p>
			{onRetry && (
				<Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
					Try again
				</Button>
			)}
		</div>
	);
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
	return (
		<div className="flex flex-col gap-3">
			{Array.from({ length: rows }).map((_, i) => (
				// biome-ignore lint: static skeleton list
				<Skeleton key={i} className="h-16 w-full rounded-lg" />
			))}
		</div>
	);
}
