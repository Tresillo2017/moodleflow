"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useMoodleLinkOpener } from "@/hooks/use-moodle-link";
import { ListSkeleton } from "@/components/ui/state";
import { courseHue, formatDistanceToNow } from "@/lib/format";
import type { RecentItem } from "@/types/calendar";

/** Activities opened recently (Moodle's "Recently accessed items" block). Renders nothing when the site has none. */
export function RecentItems() {
	const { client, connection } = useMoodleConnection();
	const router = useRouter();
	const openUrl = useMoodleLinkOpener();
	const items = useMoodleQuery(client ? () => client.getRecentItems(6).catch(() => [] as RecentItem[]) : null, [client]);

	function open(item: RecentItem) {
		if (connection && item.url) void openUrl(item.url);
		else router.push(`/courses/${item.courseId}`);
	}

	if (items.loading) return <ListSkeleton rows={2} />;
	if (!items.data?.length) return null;
	return (
		<ul className="st-group flex flex-col divide-y">
			{items.data.map((item) => (
				<li key={item.id}>
					<button type="button" onClick={() => open(item)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
						<Clock className="size-4 shrink-0" style={{ color: `oklch(0.6 0.15 ${courseHue(item.courseId)})` }} aria-hidden="true" />
						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium">{item.name}</span>
							<span className="block truncate text-xs text-muted-foreground">{item.courseName}</span>
						</span>
						<span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(item.accessedAt)}</span>
					</button>
				</li>
			))}
		</ul>
	);
}

/** Courses opened recently, for the courses page header and the dashboard; ids only, resolved against the enrolled list. */
export function RecentCourses({ courseIds, names }: { courseIds: number[]; names: Map<number, string> }) {
	if (courseIds.length === 0) return null;
	return (
		<nav aria-label="Recent courses" className="flex flex-wrap gap-2">
			{courseIds.map((id) => (
				<Link key={id} href={`/courses/${id}`} className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-muted">
					{names.get(id) ?? `Course ${id}`}
				</Link>
			))}
		</nav>
	);
}
