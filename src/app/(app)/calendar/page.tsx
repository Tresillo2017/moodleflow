"use client";

import { useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, ListSkeleton, FeatureGate } from "@/components/ui/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EventDialog } from "@/components/calendar/event-dialog";
import { EventForm } from "@/components/calendar/event-form";
import { ExportLink } from "@/components/calendar/export-link";
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, FileQuestion, User } from "lucide-react";
import { courseHue, formatDayLabel, formatEventTime } from "@/lib/format";
import { hour12Of } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import type { MoodleCalendarEvent } from "@/types/moodle";

type View = "agenda" | "month";

interface EventFilter {
	courseId: number;
	type: MoodleCalendarEvent["type"] | "all";
}

const NO_FILTER: EventFilter = { courseId: 0, type: "all" };
const TYPE_LABELS: Record<MoodleCalendarEvent["type"], string> = {
	assignment: "Assignments",
	quiz: "Quizzes",
	course: "Course events",
	personal: "Personal",
	other: "Other",
};

function applyFilter(events: MoodleCalendarEvent[], f: EventFilter): MoodleCalendarEvent[] {
	return events.filter((e) => (!f.courseId || e.courseId === f.courseId) && (f.type === "all" || e.type === f.type));
}

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

function EventRow({ event: e, hour12, onOpen }: { event: MoodleCalendarEvent; hour12?: boolean; onOpen: (e: MoodleCalendarEvent) => void }) {
	const Icon = TYPE_ICONS[e.type];
	return (
		<button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-4 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
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
		</button>
	);
}

function EventList({ events, hour12, onOpen }: { events: MoodleCalendarEvent[]; hour12?: boolean; onOpen: (e: MoodleCalendarEvent) => void }) {
	return (
		<div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
			{events.map((e) => (
				<EventRow key={e.id} event={e} hour12={hour12} onOpen={onOpen} />
			))}
		</div>
	);
}

interface MonthViewProps {
	filter: EventFilter;
	hour12?: boolean;
	weekStartsMonday: boolean;
	reloadKey: number;
	onOpen: (e: MoodleCalendarEvent) => void;
}

function MonthView({ filter, hour12, weekStartsMonday, reloadKey, onOpen }: MonthViewProps) {
	const { client } = useMoodleConnection();
	const today = new Date();
	const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
	const [selected, setSelected] = useState(() => dayKey(today));

	const year = cursor.getFullYear();
	const month = cursor.getMonth();
	const monthEvents = useMoodleQuery(client ? () => client.getCalendarMonth(year, month + 1) : null, [client, year, month, reloadKey]);
	const events = applyFilter(monthEvents.data ?? [], filter);
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
					<h2 className="text-xl" aria-live="polite">
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

				{monthEvents.error && <p role="alert" className="text-sm text-danger">{monthEvents.error.message}</p>}
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
				<h2 className="text-xl text-muted-foreground">
					{selectedDate ? formatDayLabel(selectedDate.toISOString()) : "Selected day"}
				</h2>
				{selectedEvents.length > 0 ? (
					<EventList events={selectedEvents} hour12={hour12} onOpen={onOpen} />
				) : (
					<p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
						Nothing scheduled.
					</p>
				)}
			</section>
		</div>
	);
}

function CalendarPageContent() {
	const { client, refresh } = useMoodleConnection();
	const { prefs } = usePreferences();
	const [reloadKey, setReloadKey] = useState(0);
	const upcoming = useMoodleQuery(client ? () => client.getCalendarEvents() : null, [client, reloadKey]);
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]).data ?? [];
	const [view, setView] = useState<View>("agenda");
	const [filter, setFilter] = useState<EventFilter>(NO_FILTER);
	const [open, setOpen] = useState<MoodleCalendarEvent | null>(null);
	const hour12 = hour12Of(prefs.clock);
	const events = applyFilter(upcoming.data ?? [], filter);
	const grouped = [...groupByDay(events).values()];
	const reload = () => setReloadKey((k) => k + 1);
	const select = "h-8 rounded-lg border bg-card px-2 text-sm";

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Calendar"
				description={upcoming.data ? `${events.length} upcoming ${events.length === 1 ? "event" : "events"}` : undefined}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<Tabs value={view} onValueChange={(v) => setView(v as View)}>
							<TabsList>
								<TabsTrigger value="agenda">Agenda</TabsTrigger>
								<TabsTrigger value="month">Month</TabsTrigger>
							</TabsList>
						</Tabs>
						{client?.supports("core_calendar_get_calendar_export_token") && <ExportLink />}
						{client?.supports("core_calendar_create_calendar_events") && <EventForm onCreated={reload} />}
					</div>
				}
			/>

			<div className="flex flex-wrap gap-2">
				<select aria-label="Filter by course" value={filter.courseId} onChange={(e) => setFilter({ ...filter, courseId: Number(e.target.value) })} className={select}>
					<option value={0}>All courses</option>
					{courses.map((c) => (
						<option key={c.id} value={c.id}>
							{c.shortName}
						</option>
					))}
				</select>
				<select aria-label="Filter by type" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value as EventFilter["type"] })} className={select}>
					<option value="all">All types</option>
					{(Object.keys(TYPE_LABELS) as MoodleCalendarEvent["type"][]).map((t) => (
						<option key={t} value={t}>
							{TYPE_LABELS[t]}
						</option>
					))}
				</select>
			</div>

			{upcoming.loading && <ListSkeleton rows={4} />}
			{upcoming.error && <ErrorState error={upcoming.error} onRetry={refresh} />}

			{upcoming.data && view === "agenda" && (
				events.length === 0 ? (
					<EmptyState icon={CalendarDays} title="No upcoming events" description="Deadlines and course events will appear here." />
				) : (
					<div className="flex flex-col gap-6">
						{grouped.map((dayEvents, i) => (
							<section
								key={dayEvents[0].id}
								className="flex flex-col gap-2 animate-track-in"
								style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
							>
								<h2 className="text-xl text-muted-foreground">{formatDayLabel(dayEvents[0].startDate)}</h2>
								<EventList events={dayEvents} hour12={hour12} onOpen={setOpen} />
							</section>
						))}
					</div>
				)
			)}

			{view === "month" && (
				<MonthView filter={filter} hour12={hour12} weekStartsMonday={prefs.weekStart === "monday"} reloadKey={reloadKey} onOpen={setOpen} />
			)}

			<EventDialog event={open} hour12={hour12} onClose={() => setOpen(null)} onChanged={reload} />
		</div>
	);
}

export default function CalendarPage() {
	return (
		<FeatureGate feature="Calendar" functions={["core_calendar_get_calendar_upcoming_view"]}>
			<CalendarPageContent />
		</FeatureGate>
	);
}
