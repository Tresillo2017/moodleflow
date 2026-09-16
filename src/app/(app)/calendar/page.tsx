"use client";

import { useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays } from "lucide-react";
import { formatEventTime } from "@/lib/format";

export default function CalendarPage() {
	const { client } = useMoodleConnection();
	const events = useMoodleQuery(client ? () => client.getCalendarEvents() : null, [client]);
	const [view, setView] = useState<"agenda" | "month">("agenda");

	const grouped = groupByDay(events.data ?? []);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
				<Tabs value={view} onValueChange={(v) => setView(v as "agenda" | "month")}>
					<TabsList>
						<TabsTrigger value="agenda">Agenda</TabsTrigger>
						<TabsTrigger value="month">Month</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			{events.loading && <ListSkeleton rows={4} />}
			{events.error && <ErrorState error={events.error} />}
			{events.data && events.data.length === 0 && (
				<EmptyState icon={CalendarDays} title="No upcoming events" />
			)}

			{events.data && events.data.length > 0 && view === "agenda" && (
				<div className="flex flex-col gap-6">
					{grouped.map(([day, dayEvents]) => (
						<div key={day} className="flex flex-col gap-2">
							<h2 className="text-sm font-medium text-muted-foreground">{day}</h2>
							<div className="flex flex-col divide-y rounded-lg border">
								{dayEvents.map((e) => (
									<div key={e.id} className="flex items-center gap-4 px-4 py-3 text-sm">
										<span className="w-14 shrink-0 tabular-nums text-muted-foreground">
											{formatEventTime(e.startDate)}
										</span>
										<div className="min-w-0">
											<p className="truncate font-medium">{e.name}</p>
											{e.courseName && (
												<p className="truncate text-xs text-muted-foreground">{e.courseName}</p>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{events.data && view === "month" && <MonthGrid events={events.data} />}
		</div>
	);
}

function groupByDay(events: { id: number; name: string; startDate: string; courseName?: string }[]) {
	const map = new Map<string, typeof events>();
	for (const e of events) {
		const key = new Date(e.startDate).toLocaleDateString(undefined, {
			weekday: "long",
			month: "short",
			day: "numeric",
		});
		map.set(key, [...(map.get(key) ?? []), e]);
	}
	return Array.from(map.entries());
}

function MonthGrid({ events }: { events: { id: number; name: string; startDate: string }[] }) {
	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth();
	const firstDay = new Date(year, month, 1);
	const startOffset = firstDay.getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();

	const eventsByDate = new Map<number, number>();
	for (const e of events) {
		const d = new Date(e.startDate);
		if (d.getFullYear() === year && d.getMonth() === month) {
			eventsByDate.set(d.getDate(), (eventsByDate.get(d.getDate()) ?? 0) + 1);
		}
	}

	const cells: Array<number | null> = [
		...Array.from({ length: startOffset }, () => null),
		...Array.from({ length: daysInMonth }, (_, i) => i + 1),
	];

	return (
		<div className="grid grid-cols-7 gap-1 text-center text-xs">
			{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
				<div key={`${d}-${i}`} className="pb-1 font-medium text-muted-foreground">
					{d}
				</div>
			))}
			{cells.map((day, i) => (
				<div
					key={i}
					className={`flex aspect-square flex-col items-center justify-center rounded-md border text-sm ${
						day === today.getDate() ? "border-primary bg-primary/5 font-medium" : "border-transparent"
					}`}
				>
					{day}
					{day && eventsByDate.has(day) && <span className="mt-0.5 size-1 rounded-full bg-primary" />}
				</div>
			))}
		</div>
	);
}
