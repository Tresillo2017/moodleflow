"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { CheckCheck, GraduationCap, Percent, TrendingDown, Trophy } from "lucide-react";
import { CourseGrades } from "@/components/grades/course-grades";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import {
	coursePercent,
	itemPercent,
	recentGrades,
	sortCourseGrades,
	summarizeGrades,
	withCourseNames,
	type GradeSort,
} from "@/lib/moodle/grade-stats";
import { AreaChart } from "@/components/dither-kit/area-chart";
import { Area } from "@/components/dither-kit/area";
import { Grid } from "@/components/dither-kit/grid";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import { buildGradeTrend } from "@/lib/moodle/grade-trend";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { chartOf } from "@/lib/preferences";

const SORTS: { value: GradeSort; label: string }[] = [
	{ value: "name", label: "Name" },
	{ value: "highest", label: "Highest" },
	{ value: "lowest", label: "Lowest" },
];

function StatTile({
	icon: Icon,
	label,
	value,
	detail,
	tone,
}: {
	icon: React.ElementType;
	label: string;
	value: string;
	detail?: string;
	tone?: "success" | "danger";
}) {
	return (
		<div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
			<div
				className={cn(
					"flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
					tone === "success" && "bg-success/15 text-success",
					tone === "danger" && "bg-danger/10 text-danger",
				)}
			>
				<Icon className="size-4" aria-hidden="true" />
			</div>
			<div className="min-w-0">
				<p className="text-xl leading-tight font-semibold tabular-nums">{value}</p>
				<p className="truncate text-xs text-muted-foreground">{label}</p>
				{detail && <p className="truncate text-xs text-muted-foreground/80">{detail}</p>}
			</div>
		</div>
	);
}

export default function GradesPage() {
	const { client, refresh } = useMoodleConnection();
	const { prefs } = usePreferences();
	const grades = useMoodleQuery(client ? () => client.getGrades() : null, [client]);
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const [sort, setSort] = useState<GradeSort>("name");
	const [query, setQuery] = useState("");

	const currentGrades = useMemo(() => {
		if (!grades.data || !courses.data) return undefined;
		const ids = new Set(courses.data.filter(isCurrentCourse).map((c) => c.id));
		return withCourseNames(
			grades.data.filter((g) => ids.has(g.courseId)),
			courses.data,
		);
	}, [grades.data, courses.data]);
	const trend = useMemo(() => (currentGrades ? buildGradeTrend(currentGrades) : []), [currentGrades]);
	const summary = useMemo(() => (currentGrades ? summarizeGrades(currentGrades) : undefined), [currentGrades]);
	const recent = useMemo(() => (currentGrades ? recentGrades(currentGrades) : []), [currentGrades]);

	const needle = query.trim().toLowerCase();
	const visible = useMemo(() => {
		if (!currentGrades) return [];
		const sorted = sortCourseGrades(currentGrades, sort);
		if (!needle) return sorted;
		return sorted.filter(
			(g) => g.courseName.toLowerCase().includes(needle) || g.items.some((i) => i.itemName.toLowerCase().includes(needle)),
		);
	}, [currentGrades, sort, needle]);

	const loading = grades.loading || courses.loading;
	const error = grades.error ?? courses.error;

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Grades"
				description={
					summary?.overall !== undefined
						? `Averaging ${Math.round(summary.overall)}% across your current courses`
						: "Your grades across current courses"
				}
			/>

			{loading && <ListSkeleton rows={4} />}
			{error && <ErrorState error={error} onRetry={refresh} />}
			{currentGrades && currentGrades.length === 0 && (
				<EmptyState icon={GraduationCap} title="No grades yet" description="Grades from your active courses show up here." />
			)}

			{summary && currentGrades && currentGrades.length > 0 && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<StatTile
						icon={Percent}
						label="Overall average"
						value={summary.overall !== undefined ? `${Math.round(summary.overall)}%` : "—"}
						detail={`${currentGrades.length} ${currentGrades.length === 1 ? "course" : "courses"}`}
					/>
					<StatTile
						icon={Trophy}
						tone="success"
						label="Best course"
						value={summary.best ? `${Math.round(summary.best.percent)}%` : "—"}
						detail={summary.best?.course.courseName}
					/>
					<StatTile
						icon={TrendingDown}
						tone={summary.worst && summary.worst.percent < 50 ? "danger" : undefined}
						label="Needs attention"
						value={summary.worst ? `${Math.round(summary.worst.percent)}%` : "—"}
						detail={summary.worst?.course.courseName}
					/>
					<StatTile
						icon={CheckCheck}
						label="Items graded"
						value={`${summary.gradedCount}/${summary.itemCount}`}
						detail={summary.itemCount > 0 ? `${Math.round((summary.gradedCount / summary.itemCount) * 100)}% marked` : undefined}
					/>
				</div>
			)}

			{(trend.length > 1 || recent.length > 0) && (
				<div className={cn("grid gap-4", trend.length > 1 && recent.length > 0 && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")}>
					{trend.length > 1 && (
						<section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
							<div className="flex items-baseline justify-between">
								<h2 className="text-xl">Weekly average</h2>
								<span className="text-xs text-muted-foreground">Last {trend.length} weeks with grades</span>
							</div>
							<div className="h-64">
								<AreaChart data={trend} config={{ average: { label: "Weekly average", color: chartOf(prefs) } }}>
									<Grid />
									<XAxis
										dataKey="week"
										tickFormatter={(v) => new Date(String(v)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
									/>
									<YAxis tickFormatter={(v) => `${v}%`} />
									<Area dataKey="average" />
								</AreaChart>
							</div>
						</section>
					)}
					{recent.length > 0 && (
						<section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
							<h2 className="text-xl">Recently graded</h2>
							<ul className="flex flex-col divide-y">
								{recent.map(({ item, courseId, courseName }) => {
									const p = itemPercent(item);
									return (
										<li key={`${courseId}-${item.id}`}>
											<Link
												href={`/courses/${courseId}`}
												className="flex items-center gap-3 rounded-md py-2 text-sm transition-colors hover:text-primary focus-visible:outline-none"
											>
												<span className="min-w-0 flex-1">
													<span className="block truncate font-medium">{item.itemName}</span>
													<span className="block truncate text-xs text-muted-foreground">
														{courseName} · {new Date(item.gradedDate!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
													</span>
												</span>
												<span className={cn("font-semibold tabular-nums", p !== undefined && p >= 80 && "text-success", p !== undefined && p < 50 && "text-danger")}>
													{p !== undefined ? `${Math.round(p)}%` : item.grade}
												</span>
											</Link>
										</li>
									);
								})}
							</ul>
						</section>
					)}
				</div>
			)}

			{currentGrades && currentGrades.length > 0 && (
				<section className="flex flex-col gap-3">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<SearchInput
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search courses or graded items"
							aria-label="Search courses or graded items"
							className="w-full sm:max-w-xs"
						/>
						<div role="group" aria-label="Sort courses" className="inline-flex rounded-lg bg-muted p-[3px] text-sm">
							{SORTS.map((o) => (
								<button
									key={o.value}
									type="button"
									aria-pressed={sort === o.value}
									onClick={() => setSort(o.value)}
									className={cn(
										"rounded-md px-3 py-1 text-muted-foreground transition-colors focus-visible:outline-2",
										sort === o.value && "bg-background font-medium text-foreground shadow-xs",
									)}
								>
									{o.label}
								</button>
							))}
						</div>
					</div>
					{visible.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</p>}
					{visible.map((course, i) => (
						<div key={`${course.courseId}-${needle ? "q" : ""}`} className="animate-track-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
							<CourseGrades course={course} query={query} defaultOpen={needle !== ""} />
						</div>
					))}
				</section>
			)}
		</div>
	);
}
