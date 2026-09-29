"use client";

import { useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, FileQuestion, User } from "lucide-react";
import { courseHue, formatDayLabel, formatEventTime } from "@/lib/format";
import { hour12Of } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import type { MoodleCalendarEvent } from "@/types/moodle";

type View = "agenda" | "month";

const TYPE_ICONS: Record<MoodleCalendarEvent["type"], React.ElementType> = {
	assignment: ClipboardList,
	quiz: FileQuestion,
	course: BookOpen,
	personal: User,
	other: CalendarDays,
};

/** Local-time day key; toISOString would shift late-evening events into the next UTC day. */
function dayKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function groupByDay(events: MoodleCalendarEvent[]): Map<string, MoodleCalendarEvent[]> {
	const map = new Map<string, MoodleCalendarEvent[]>();
	for (const e of [...events].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
		const key = dayKey(new Date(e.startDate));
		map.set(key, [...(map.get(key) ?? []), e]);
	}
	return map;
}

function EventRow({ event: e, hour12 }: { event: MoodleCalendarEvent; hour12?: boolean }) {
	const Icon = TYPE_ICONS[e.type];
	return (
		<div className="flex items-center gap-4 px-4 py-3 text-sm">
			<span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{formatEventTime(e.startDate, hour12)}</span>
			<span
				className="grid size-7 shrink-0 place-items-center rounded-md"
				style={{
					background: `oklch(0.68 0.15 ${courseHue(e.courseId ?? 0)} / 15%)`,
					color: `oklch(0.6 0.15 ${courseHue(e.courseId ?? 0)})`,
				}}
			>
				<Icon className="size-3.5" aria-hidden="true" />
			</span>
			<div className="min-w-0">
				<p className="truncate font-medium">{e.name}</p>
				{e.courseName && <p className="truncate text-xs text-muted-foreground">{e.courseName}</p>}
			</div>
		</div>
	);
}

function EventList({ events, hour12 }: { events: MoodleCalendarEvent[]; hour12?: boolean }) {
	return (
		<div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
			{events.map((e) => (
				<EventRow key={e.id} event={e} hour12={hour12} />
			))}
		</div>
	);
}

function MonthView({ events, hour12, weekStartsMonday }: { events: MoodleCalendarEvent[]; hour12?: boolean; weekStartsMonday: boolean }) {
	const today = new Date();
	const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
	const [selected, setSelected] = useState(() => dayKey(today));

	const year = cursor.getFullYear();
	const month = cursor.getMonth();
	const offset = (cursor.getDay() - (weekStartsMonday ? 1 : 0) + 7) % 7;
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const byDay = groupByDay(events);
	const weekdays = Array.from({ length: 7 }, (_, i) =>
		// Jan 4 2026 is a Sunday; offset from there to get localized weekday names.
		new Date(2026, 0, 4 + i + (weekStartsMonday ? 1 : 0)).toLocaleDateString(undefined, { weekday: "narrow" }),
	);
	const cells: Array<Date | null> = [
		...Array.from({ length: offset }, () => null),
		...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
	];
	const selectedEvents = byDay.get(selected) ?? [];
	const selectedDate = cells.find((d) => d && dayKey(d) === selected);

	function shift(delta: number) {
		setCursor(new Date(year, month + delta, 1));
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:p-4">
				<div className="flex items-center justify-between gap-2">
					<h2 className="text-sm font-semibold" aria-live="polite">
						{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
					</h2>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
								setSelected(dayKey(today));
							}}
						>
							Today
						</Button>
						<Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => shift(-1)}>
							<ChevronLeft aria-hidden="true" />
						</Button>
						<Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => shift(1)}>
							<ChevronRight aria-hidden="true" />
						</Button>
					</div>
				</div>

				<div key={`${year}-${month}`} className="grid grid-cols-7 gap-1 text-center motion-safe:animate-in motion-safe:fade-in duration-200">
					{weekdays.map((d, i) => (
						<div key={i} className="pb-1 text-xs font-medium text-muted-foreground" aria-hidden="true">
							{d}
						</div>
					))}
					{cells.map((date, i) => {
						if (!date) return <div key={`blank-${i}`} />;
						const key = dayKey(date);
						const dayEvents = byDay.get(key) ?? [];
						const isToday = key === dayKey(today);
						const isSelected = key === selected;
						return (
							<button
								key={key}
								type="button"
								onClick={() => setSelected(key)}
								aria-pressed={isSelected}
								aria-label={`${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`}
								className={cn(
									"flex aspect-square flex-col items-center justify-start gap-1 rounded-lg p-1 text-sm transition-colors hover:bg-muted sm:aspect-[4/3] sm:items-start sm:p-1.5",
									isSelected && "bg-primary/10 ring-1 ring-primary/40 hover:bg-primary/15",
								)}
							>
								<span
									className={cn(
										"grid size-6 place-items-center rounded-full text-xs tabular-nums",
										isToday && "bg-primary font-semibold text-primary-foreground",
									)}
								>
									{date.getDate()}
								</span>
								{dayEvents.length > 0 && (
									<>
										<span className="flex gap-0.5 sm:hidden" aria-hidden="true">
											{dayEvents.slice(0, 3).map((e) => (
												<span key={e.id} className="size-1 rounded-full bg-primary" />
											))}
										</span>
										<span className="hidden w-full flex-col gap-0.5 sm:flex" aria-hidden="true">
											{dayEvents.slice(0, 2).map((e) => (
												<span
													key={e.id}
													className="truncate rounded px-1 text-left text-[10px] leading-4"
													style={{ background: `oklch(0.68 0.15 ${courseHue(e.courseId ?? 0)} / 18%)` }}
												>
													{e.name}
												</span>
											))}
											{dayEvents.length > 2 && (
												<span className="px-1 text-left text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</span>
											)}
										</span>
									</>
								)}
							</button>
						);
					})}
				</div>
			</div>

			<section className="flex flex-col gap-2">
				<h2 className="text-sm font-medium text-muted-foreground">
					{selectedDate ? formatDayLabel(selectedDate.toISOString()) : "Selected day"}
				</h2>
				{selectedEvents.length > 0 ? (
					<EventList events={selectedEvents} hour12={hour12} />
				) : (
					<p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
						Nothing scheduled.
					</p>
				)}
			</section>
		</div>
	);
}

export default function CalendarPage() {
	const { client, refresh } = useMoodleConnection();
	const { prefs } = usePreferences();
	const events = useMoodleQuery(client ? () => client.getCalendarEvents() : null, [client]);
	const [view, setView] = useState<View>("agenda");
	const hour12 = hour12Of(prefs.clock);
	const grouped = [...groupByDay(events.data ?? []).values()];

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Calendar"
				description={events.data ? `${events.data.length} upcoming ${events.data.length === 1 ? "event" : "events"}` : undefined}
				actions={
					<Tabs value={view} onValueChange={(v) => setView(v as View)}>
						<TabsList>
							<TabsTrigger value="agenda">Agenda</TabsTrigger>
							<TabsTrigger value="month">Month</TabsTrigger>
						</TabsList>
					</Tabs>
				}
			/>

			{events.loading && <ListSkeleton rows={4} />}
			{events.error && <ErrorState error={events.error} onRetry={refresh} />}

			{events.data && view === "agenda" && (
				events.data.length === 0 ? (
					<EmptyState icon={CalendarDays} title="No upcoming events" description="Deadlines and course events will appear here." />
				) : (
					<div className="flex flex-col gap-6">
						{grouped.map((dayEvents, i) => (
							<section
								key={dayEvents[0].id}
								className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 fill-mode-backwards duration-300 ease-out"
								style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
							>
								<h2 className="text-sm font-medium text-muted-foreground">{formatDayLabel(dayEvents[0].startDate)}</h2>
								<EventList events={dayEvents} hour12={hour12} />
							</section>
						))}
					</div>
				)
			)}

			{events.data && view === "month" && (
				<MonthView events={events.data} hour12={hour12} weekStartsMonday={prefs.weekStart === "monday"} />
			)}
		</div>
	);
}
