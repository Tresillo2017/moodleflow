"use client";

import { useAssignments } from "@/hooks/use-assignments";
import Link from "next/link";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { CourseCard } from "@/components/courses/course-card";
import { isDone } from "@/lib/moodle/assignment";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { MoodleActivityCard } from "@/components/dashboard/moodle-activity-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildGradeTrend } from "@/lib/moodle/grade-trend";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { courseHue, formatDayLabel, formatEventTime } from "@/lib/format";
import { ACCENTS, DASHBOARD_SECTIONS, hour12Of, type DashboardSection } from "@/lib/preferences";
import {
	AlertTriangle,
	BookOpen,
	CalendarClock,
	ChevronRight,
	ClipboardList,
	GraduationCap,
	PartyPopper,
	Settings2,
} from "lucide-react";
import type { MoodleAssignment } from "@/types/moodle";

const WEEK_MS = 7 * 86_400_000;

function greeting() {
	const hour = new Date().getHours();
	if (hour < 5) return "Still up";
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

function isOpen(a: MoodleAssignment) {
	return !isDone(a);
}

/** Section wrapper with a staggered entrance; index controls the delay. Disabled under reduced motion. */
function Reveal({ index, children, className }: { index: number; children: React.ReactNode; className?: string }) {
	return (
		<div
			className={`motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 fill-mode-backwards duration-500 ease-out ${className ?? ""}`}
			style={{ animationDelay: `${index * 60}ms` }}
		>
			{children}
		</div>
	);
}

function SectionHeading({ title, href, linkLabel = "View all" }: { title: string; href?: string; linkLabel?: string }) {
	return (
		<div className="flex items-center justify-between">
			<h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
			{href && (
				<Link href={href} className="group flex items-center gap-0.5 text-xs text-primary hover:underline">
					{linkLabel}
					<ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
				</Link>
			)}
		</div>
	);
}

function StatCard({
	icon: Icon,
	label,
	value,
	href,
	tone = "primary",
}: {
	icon: React.ElementType;
	label: string;
	value: string;
	href: string;
	tone?: "primary" | "danger";
}) {
	return (
		<Link href={href} className="group rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
			<Card className="h-full flex-row items-center gap-3 px-4 transition-[border-color,translate,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-primary/40 group-active:translate-y-0">
				<div
					className={
						tone === "danger"
							? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger"
							: "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
					}
				>
					<Icon className="size-4" aria-hidden="true" />
				</div>
				<div className="min-w-0">
					<p className="text-lg leading-none font-semibold tabular-nums">{value}</p>
					<p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
				</div>
			</Card>
		</Link>
	);
}

function CustomizeMenu() {
	const { prefs, setPref } = usePreferences();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="sm" className="bg-background/60 backdrop-blur" />}>
				<Settings2 aria-hidden="true" />
				Customize
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Show on dashboard</DropdownMenuLabel>
					{(Object.keys(DASHBOARD_SECTIONS) as DashboardSection[]).map((key) => (
						<DropdownMenuCheckboxItem
							key={key}
							checked={prefs.dashboard[key]}
							onCheckedChange={(checked) => setPref("dashboard", { ...prefs.dashboard, [key]: checked })}
						>
							{DASHBOARD_SECTIONS[key]}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem render={<Link href="/settings" />}>More settings…</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export default function DashboardPage() {
	const { client, connection } = useMoodleConnection();
	const { prefs } = usePreferences();
	const show = prefs.dashboard;
	const hour12 = hour12Of(prefs.clock);

	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const assignments = useAssignments();
	const events = useMoodleQuery(client ? () => client.getCalendarEvents() : null, [client]);
	const grades = useMoodleQuery(client ? () => client.getGrades() : null, [client]);

	const firstName = connection?.userFullName?.split(" ")[0] ?? "there";
	const currentCourses = courses.data?.filter(isCurrentCourse);
	const currentCourseIds = new Set(currentCourses?.map((c) => c.id));
	const now = Date.now();
	const open = (assignments.data ?? [])
		.filter((a) => isOpen(a) && a.dueDate && currentCourseIds.has(a.courseId))
		.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
	const overdue = open.filter((a) => new Date(a.dueDate!).getTime() < now);
	const dueThisWeek = open.filter((a) => {
		const t = new Date(a.dueDate!).getTime();
		return t >= now && t - now <= WEEK_MS;
	});
	const upcoming = open.slice(0, 5);
	const nextEvents = [...(events.data ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
	const starred = currentCourses?.filter((c) => c.isFavourite) ?? [];
	const shownCourses = starred.length > 0 ? starred : (currentCourses ?? []);
	const trend = grades.data ? buildGradeTrend(grades.data) : [];
	const currentAverage = trend.at(-1)?.average;
	const loaded = Boolean(assignments.data && courses.data);

	const summary = !loaded
		? "Loading your week…"
		: dueThisWeek.length === 0 && overdue.length === 0
			? "Nothing due this week. Enjoy it."
			: [
					dueThisWeek.length > 0 && `${dueThisWeek.length} due this week`,
					overdue.length > 0 && `${overdue.length} overdue`,
				]
					.filter(Boolean)
					.join(" · ");

	const nothingShown = !Object.values(show).some(Boolean);

	return (
		<div className="flex flex-col gap-8">
			<Reveal index={0}>
				<div className="relative overflow-hidden rounded-xl border px-6 py-7">
					<DitherGradient
						from={ACCENTS[prefs.accent].ditherHue}
						direction="up"
						opacity={0.5}
						className="[mask-image:linear-gradient(to_top,black,transparent)]"
					/>
					<div className="relative flex flex-wrap items-end justify-between gap-4">
						<div className="flex flex-col gap-1">
							<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
								{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
							</p>
							<h1 className="text-2xl font-semibold tracking-tight text-balance">
								{greeting()}, {firstName}
							</h1>
							<p className="text-sm text-muted-foreground">{summary}</p>
						</div>
						<CustomizeMenu />
					</div>
				</div>
			</Reveal>

			{nothingShown && (
				<EmptyState
					icon={Settings2}
					title="Your dashboard is empty"
					description="All sections are hidden. Use Customize to bring some back."
				/>
			)}

			{show.stats && (
				<Reveal index={1}>
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<StatCard icon={BookOpen} label="Active courses" value={currentCourses ? String(currentCourses.length) : "—"} href="/courses" />
						<StatCard icon={ClipboardList} label="Due this week" value={loaded ? String(dueThisWeek.length) : "—"} href="/assignments" />
						<StatCard
							icon={AlertTriangle}
							label="Overdue"
							value={loaded ? String(overdue.length) : "—"}
							href="/assignments"
							tone={overdue.length > 0 ? "danger" : "primary"}
						/>
						<StatCard
							icon={GraduationCap}
							label="Recent average"
							value={currentAverage !== undefined ? `${currentAverage}%` : "—"}
							href="/grades"
						/>
					</div>
				</Reveal>
			)}

			{(show.upcoming || show.calendar) && (
				<div className={show.upcoming && show.calendar ? "grid gap-8 lg:grid-cols-2" : "grid gap-8"}>
					{show.upcoming && (
						<Reveal index={2}>
							<section className="flex flex-col gap-3">
								<SectionHeading title="Upcoming" href="/assignments" />
								{assignments.loading && <ListSkeleton rows={3} />}
								{assignments.error && <ErrorState error={assignments.error} />}
								{!assignments.loading && !assignments.error && upcoming.length === 0 && (
									<EmptyState icon={PartyPopper} title="Nothing due soon" description="You're all caught up." />
								)}
								{upcoming.length > 0 && (
									<div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
										{upcoming.map((a) => (
											<Link
												key={a.id}
												href={`/courses/${a.courseId}`}
												className="flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
											>
												<div className="flex min-w-0 items-center gap-3">
													<span
														className="h-8 w-1 shrink-0 rounded-full"
														style={{ background: `oklch(0.68 0.15 ${courseHue(a.courseId)})` }}
														aria-hidden="true"
													/>
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
						</Reveal>
					)}

					{show.calendar && (
						<Reveal index={3}>
							<section className="flex flex-col gap-3">
								<SectionHeading title="Calendar" href="/calendar" linkLabel="Open calendar" />
								{events.loading && <ListSkeleton rows={3} />}
								{events.error && <ErrorState error={events.error} />}
								{events.data && events.data.length === 0 && <EmptyState icon={CalendarClock} title="No upcoming events" />}
								{events.data && events.data.length > 0 && (
									<div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
										{nextEvents.map((e) => (
											<div key={e.id} className="flex items-center gap-4 px-4 py-3 text-sm">
												<div className="w-24 shrink-0 text-xs leading-tight">
													<p className="font-medium">{formatDayLabel(e.startDate)}</p>
													<p className="text-muted-foreground tabular-nums">{formatEventTime(e.startDate, hour12)}</p>
												</div>
												<div className="min-w-0">
													<p className="truncate font-medium">{e.name}</p>
													{e.courseName && <p className="truncate text-xs text-muted-foreground">{e.courseName}</p>}
												</div>
											</div>
										))}
									</div>
								)}
							</section>
						</Reveal>
					)}
				</div>
			)}

			{show.courses && (
				<Reveal index={4}>
					<section className="flex flex-col gap-3">
						<SectionHeading title={starred.length > 0 ? "Starred courses" : "My courses"} href="/courses" />
						{courses.loading && <ListSkeleton rows={2} />}
						{courses.error && <ErrorState error={courses.error} />}
						{shownCourses.length > 0 && (
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{shownCourses.slice(0, 6).map((c) => (
									<CourseCard key={c.id} course={c} />
								))}
							</div>
						)}
					</section>
				</Reveal>
			)}

			{show.activity && (
				<Reveal index={5}>
					<section className="flex flex-col gap-3">
						<SectionHeading title="Activity" />
						<MoodleActivityCard />
					</section>
				</Reveal>
			)}
		</div>
	);
}
