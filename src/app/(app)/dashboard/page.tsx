"use client";

import { useAssignments } from "@/hooks/use-assignments";
import Link from "next/link";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { isDone } from "@/lib/moodle/assignment";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { EmptyState, ErrorState, ListSkeleton, FeatureGate } from "@/components/ui/state";
import { PageSplit } from "@/components/layout/page-split";
import { CourseCarousel } from "@/components/dashboard/course-carousel";
import { NAV_ITEMS, PROFILE_ITEM } from "@/lib/nav";
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
import { DASHBOARD_SECTIONS, hour12Of, type DashboardSection } from "@/lib/preferences";
import {
	AlertTriangle,
	BookOpen,
	CalendarClock,
	ChevronRight,
	ClipboardList,
	GraduationCap,
	Settings2,
} from "lucide-react";
import type { MoodleAssignment } from "@/types/moodle";

const WEEK_MS = 7 * 86_400_000;

function isOpen(a: MoodleAssignment) {
	return !isDone(a);
}

/** Section wrapper with a staggered entrance; index controls the delay. Disabled under reduced motion. */
function Reveal({ index, children, className }: { index: number; children: React.ReactNode; className?: string }) {
	return (
		<div
			className={`animate-track-in ${className ?? ""}`}
			style={{ animationDelay: `${index * 60}ms` }}
		>
			{children}
		</div>
	);
}

function SectionHeading({ title, href, linkLabel = "View all" }: { title: string; href?: string; linkLabel?: string }) {
	return (
		<div className="flex items-center justify-between">
			<h2 className="text-xl text-muted-foreground">{title}</h2>
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

const ASIDE_LINKS = [PROFILE_ITEM, ...NAV_ITEMS.filter((i) => ["/courses", "/assignments", "/grades"].includes(i.href))];

/** Right column: quick links, then the deadlines coming up (bleh's "Scrobbling now" slot). */
function DashboardAside({ upcoming, loading, showUpcoming }: { upcoming: MoodleAssignment[]; loading: boolean; showUpcoming: boolean }) {
	return (
		<>
			<nav aria-label="Quick links" className="st-group flex flex-col divide-y">
				{ASIDE_LINKS.map(({ href, label, icon: Icon }) => (
					<Link
						key={href}
						href={href}
						className="flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
					>
						<Icon className="size-4 text-(--sh-accent-2)" aria-hidden="true" />
						{label.replace("My ", "")}
					</Link>
				))}
			</nav>
			{showUpcoming && (
				<section className="flex flex-col gap-3">
					<h2 className="font-sans text-base font-semibold not-italic">Due soon</h2>
					{loading && <ListSkeleton rows={3} />}
					{!loading && upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nothing due soon. You&apos;re all caught up.</p>}
					<ul className="flex flex-col gap-3">
						{upcoming.map((a) => (
							<li key={a.id}>
								<Link href={`/courses/${a.courseId}`} className="group flex items-center gap-3 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
									<span
										className="grid size-10 shrink-0 place-items-center rounded-lg text-white/90"
										style={{ background: `linear-gradient(135deg, oklch(0.62 0.14 ${courseHue(a.courseId)}), oklch(0.45 0.12 ${courseHue(a.courseId) + 40}))` }}
										aria-hidden="true"
									>
										<ClipboardList className="size-4" />
									</span>
									<span className="min-w-0 flex-1 text-sm leading-tight">
										<span className="block truncate font-medium group-hover:underline">{a.name}</span>
										<span className="block truncate text-xs text-muted-foreground">{a.courseName}</span>
									</span>
									<DeadlineBadge dueDate={a.dueDate} />
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}
		</>
	);
}

function DashboardPageContent() {
	const { client } = useMoodleConnection();
	const { prefs } = usePreferences();
	const show = prefs.dashboard;
	const hour12 = hour12Of(prefs.clock);

	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const assignments = useAssignments();
	const events = useMoodleQuery(client ? () => client.getCalendarEvents() : null, [client]);
	const grades = useMoodleQuery(client ? () => client.getGrades() : null, [client]);

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
	const dueCounts = new Map<number, number>();
	for (const a of open) dueCounts.set(a.courseId, (dueCounts.get(a.courseId) ?? 0) + 1);
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
		<PageSplit aside={<DashboardAside upcoming={upcoming} loading={assignments.loading} showUpcoming={show.upcoming} />}>
			<div className="flex flex-col gap-8">
				<Reveal index={0}>
					<div className="relative flex flex-col items-center gap-1 pt-4 text-center">
						<div className="absolute top-0 right-0">
							<CustomizeMenu />
						</div>
						<h2 className="px-20 text-[2rem] leading-tight text-balance">{starred.length > 0 ? "Your starred courses" : "Your courses"}</h2>
						<p className="text-sm text-muted-foreground">{summary}</p>
					</div>
				</Reveal>

				{nothingShown && (
					<EmptyState
						icon={Settings2}
						title="Your dashboard is empty"
						description="All sections are hidden. Use Customize to bring some back."
					/>
				)}

				{show.courses && (
					<Reveal index={1}>
						<section className="-mx-6 flex flex-col gap-3" aria-label="Courses">
							{courses.loading && <ListSkeleton rows={2} />}
							{courses.error && <ErrorState error={courses.error} />}
							{shownCourses.length > 0 && <CourseCarousel courses={shownCourses.slice(0, 12)} dueCounts={dueCounts} />}
							{shownCourses.length > 0 && (
								<Link href="/courses" className="group mx-auto flex items-center gap-0.5 text-xs text-primary hover:underline">
									All courses
									<ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
								</Link>
							)}
						</section>
					</Reveal>
				)}

				{show.calendar && (
					<Reveal index={2}>
						<section className="flex flex-col gap-3">
							<SectionHeading title="Calendar" href="/calendar" linkLabel="Open calendar" />
							{events.loading && <ListSkeleton rows={3} />}
							{events.error && <ErrorState error={events.error} />}
							{events.data && events.data.length === 0 && <EmptyState icon={CalendarClock} title="No upcoming events" />}
							{events.data && events.data.length > 0 && (
								<div className="st-group flex flex-col divide-y">
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

				{show.activity && (
					<Reveal index={3}>
						<section className="flex flex-col gap-3">
							<SectionHeading title="Activity" />
							<MoodleActivityCard />
						</section>
					</Reveal>
				)}

				{show.stats && (
					<Reveal index={4}>
						<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
							<StatCard icon={BookOpen} label="Active courses" value={currentCourses ? String(currentCourses.length) : "—"} href="/courses" />
							<StatCard icon={ClipboardList} label="Due this week" value={loaded ? String(dueThisWeek.length) : "—"} href="/assignments" />
							<StatCard
								icon={AlertTriangle}
								label="Overdue"
								value={loaded ? String(overdue.length) : "—"}
								href="/assignments"
								tone={overdue.length > 0 ? "danger" : "primary"}
							/>
							<StatCard icon={GraduationCap} label="Recent average" value={currentAverage !== undefined ? `${currentAverage}%` : "—"} href="/grades" />
						</div>
					</Reveal>
				)}
			</div>
		</PageSplit>
	);
}

export default function DashboardPage() {
	return (
		<FeatureGate feature="Dashboard" functions={["core_enrol_get_users_courses"]}>
			<DashboardPageContent />
		</FeatureGate>
	);
}
