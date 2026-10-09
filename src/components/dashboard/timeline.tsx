"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, EyeOff } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useMoodleLinkOpener } from "@/hooks/use-moodle-link";
import { courseHue, formatDayLabel, formatEventTime } from "@/lib/format";
import { modulePath } from "@/lib/moodle/links";
import { toast } from "@/lib/toast";
import type { TimelineEvent } from "@/types/calendar";

const DAY = 86_400_000;
/** Moodle's own timeline looks back two weeks for overdue items. */
const LOOKBACK_DAYS = 14;
const RANGES = { overdue: "Overdue", week: "Next 7 days", month: "Next 30 days" } as const;
type Range = keyof typeof RANGES;
type Sort = "date" | "course";

export function inRange(event: TimelineEvent, range: Range, now: number): boolean {
	const t = new Date(event.date).getTime();
	if (range === "overdue") return t < now;
	return t >= now && t - now <= (range === "week" ? 7 : 30) * DAY;
}

/** Sorted copy: by due date, or grouped by course (then date). */
export function sortTimeline(events: TimelineEvent[], sort: Sort): TimelineEvent[] {
	return [...events].sort((a, b) =>
		sort === "course" ? (a.courseName ?? "").localeCompare(b.courseName ?? "") || a.date.localeCompare(b.date) : a.date.localeCompare(b.date),
	);
}

export function Timeline({ hour12 }: { hour12?: boolean }) {
	const { client, connection } = useMoodleConnection();
	const router = useRouter();
	const openUrl = useMoodleLinkOpener();
	const [range, setRange] = useState<Range>("week");
	const [sort, setSort] = useState<Sort>("date");
	const [reloadKey, setReloadKey] = useState(0);
	const [now] = useState(() => Date.now());

	const events = useMoodleQuery(
		client ? () => client.getTimeline(new Date(now - LOOKBACK_DAYS * DAY).toISOString(), new Date(now + 30 * DAY).toISOString()) : null,
		[client, reloadKey],
	);
	// Moodle's "hidden" overview group: its events stay out of the timeline, as on Moodle's dashboard
	const hiddenIds = useMoodleQuery(client ? () => client.getCourseIdsByClassification("hidden").catch(() => [] as number[]) : null, [client, reloadKey]).data;

	const shown = useMemo(
		() => sortTimeline((events.data ?? []).filter((e) => inRange(e, range, now) && !(e.courseId && hiddenIds?.includes(e.courseId))), sort),
		[events.data, hiddenIds, range, sort, now],
	);
	const hideableCourses = new Map(shown.filter((e) => e.courseId).map((e) => [e.courseId!, e.courseName ?? ""]));

	function open(e: TimelineEvent) {
		if (connection && e.actionUrl) return void openUrl(e.actionUrl);
		if (e.courseId) router.push(e.module ? modulePath(e.module.name, e.module.instance, e.courseId) : `/courses/${e.courseId}`);
	}

	async function hideCourse(courseId: number) {
		try {
			await client?.setCourseHidden(courseId, true);
			setReloadKey((k) => k + 1);
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't hide the course.");
		}
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
					<TabsList>
						{(Object.keys(RANGES) as Range[]).map((r) => (
							<TabsTrigger key={r} value={r}>
								{RANGES[r]}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<select aria-label="Sort timeline" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="ml-auto h-8 rounded-lg border bg-card px-2 text-sm">
					<option value="date">Sort by date</option>
					<option value="course">Sort by course</option>
				</select>
			</div>
			{events.loading && <ListSkeleton rows={3} />}
			{events.error && <ErrorState error={events.error} />}
			{events.data && shown.length === 0 && <EmptyState icon={CalendarClock} title={range === "overdue" ? "Nothing overdue" : "Nothing due in this period"} />}
			{shown.length > 0 && (
				<ul className="st-group flex flex-col divide-y">
					{shown.map((e) => (
						<li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
							<span className="size-2 shrink-0 rounded-full" style={{ background: `oklch(0.68 0.15 ${courseHue(e.courseId ?? 0)})` }} aria-hidden="true" />
							<button type="button" onClick={() => open(e)} className="min-w-0 flex-1 text-left hover:underline focus-visible:underline focus-visible:outline-none">
								<span className="block truncate font-medium">{e.name}</span>
								<span className="block truncate text-xs text-muted-foreground">
									{formatDayLabel(e.date)} · {formatEventTime(e.date, hour12)}
									{e.courseName && ` · ${e.courseName}`}
								</span>
							</button>
							{e.actionLabel && <span className="hidden shrink-0 text-xs text-primary sm:block">{e.actionLabel}</span>}
						</li>
					))}
				</ul>
			)}
			{hideableCourses.size > 0 && (
				<details className="text-xs text-muted-foreground">
					<summary className="cursor-pointer select-none">Hide a course from the timeline</summary>
					<div className="mt-2 flex flex-wrap gap-2">
						{[...hideableCourses].map(([id, name]) => (
							<Button key={id} variant="outline" size="sm" onClick={() => void hideCourse(id)}>
								<EyeOff aria-hidden="true" />
								{name}
							</Button>
						))}
					</div>
				</details>
			)}
		</div>
	);
}

