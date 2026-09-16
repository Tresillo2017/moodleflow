"use client";

import Link from "next/link";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { CourseCard } from "@/components/courses/course-card";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { formatEventTime } from "@/lib/format";
import { CalendarClock, ClipboardList, PartyPopper } from "lucide-react";

export default function DashboardPage() {
	const { client, connection } = useMoodleConnection();

	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const assignments = useMoodleQuery(client ? () => client.getAssignments() : null, [client]);
	const events = useMoodleQuery(client ? () => client.getCalendarEvents() : null, [client]);

	const firstName = connection?.userFullName?.split(" ")[0] ?? "there";
	const upcoming = assignments.data
		?.filter((a) => a.status !== "graded" && a.dueDate)
		.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
		.slice(0, 5);
	const favouriteCourses = courses.data?.filter((c) => c.isFavourite) ?? courses.data ?? [];

	return (
		<div className="flex flex-col gap-8">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Good to see you, {firstName}</h1>
				<p className="text-sm text-muted-foreground">Here&apos;s what needs your attention.</p>
			</div>

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-medium text-muted-foreground">Upcoming</h2>
				{assignments.loading && <ListSkeleton rows={3} />}
				{assignments.error && <ErrorState error={assignments.error} />}
				{!assignments.loading && !assignments.error && upcoming?.length === 0 && (
					<EmptyState icon={PartyPopper} title="Nothing due soon" description="You're all caught up." />
				)}
				{upcoming && upcoming.length > 0 && (
					<div className="flex flex-col divide-y rounded-lg border">
						{upcoming.map((a) => (
							<Link
								key={a.id}
								href={`/courses/${a.courseId}`}
								className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-muted/40"
							>
								<div className="flex min-w-0 items-center gap-3">
									<ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									<div className="min-w-0">
										<p className="truncate font-medium">{a.name}</p>
										<p className="truncate text-xs text-muted-foreground">{a.courseName}</p>
									</div>
								</div>
								<DeadlineBadge dueDate={a.dueDate} />
							</Link>
						))}
					</div>
				)}
			</section>

			<section className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-medium text-muted-foreground">My Courses</h2>
					<Link href="/courses" className="text-xs text-primary hover:underline">
						View all
					</Link>
				</div>
				{courses.loading && <ListSkeleton rows={2} />}
				{courses.error && <ErrorState error={courses.error} />}
				{favouriteCourses.length > 0 && (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{favouriteCourses.slice(0, 6).map((c) => (
							<CourseCard key={c.id} course={c} />
						))}
					</div>
				)}
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-medium text-muted-foreground">Calendar</h2>
				{events.loading && <ListSkeleton rows={3} />}
				{events.error && <ErrorState error={events.error} />}
				{events.data && events.data.length === 0 && (
					<EmptyState icon={CalendarClock} title="No upcoming events" />
				)}
				{events.data && events.data.length > 0 && (
					<div className="flex flex-col divide-y rounded-lg border">
						{events.data.slice(0, 5).map((e) => (
							<div key={e.id} className="flex items-center gap-4 px-4 py-3 text-sm">
								<span className="w-14 shrink-0 tabular-nums text-muted-foreground">
									{formatEventTime(e.startDate)}
								</span>
								<div className="min-w-0">
									<p className="truncate font-medium">{e.name}</p>
									{e.courseName && <p className="truncate text-xs text-muted-foreground">{e.courseName}</p>}
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
