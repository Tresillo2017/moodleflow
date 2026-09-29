"use client";

import { useMemo } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, GraduationCap } from "lucide-react";
import { AreaChart } from "@/components/dither-kit/area-chart";
import { Area } from "@/components/dither-kit/area";
import { Grid } from "@/components/dither-kit/grid";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import { buildGradeTrend } from "@/lib/moodle/grade-trend";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { courseHue } from "@/lib/format";
import { ACCENTS } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import type { MoodleCourseGrades, MoodleGradeItem } from "@/types/moodle";

function itemPercent(item: MoodleGradeItem): number | undefined {
	if (item.percentage !== undefined) return item.percentage;
	if (item.grade === undefined || !item.maxGrade) return undefined;
	return (item.grade / item.maxGrade) * 100;
}

function coursePercent(course: MoodleCourseGrades): number | undefined {
	if (course.courseTotal !== undefined && course.courseMaxTotal) {
		return (course.courseTotal / course.courseMaxTotal) * 100;
	}
	const percents = course.items.map(itemPercent).filter((p): p is number => p !== undefined);
	return percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : undefined;
}

function toneOf(percent: number | undefined): string {
	if (percent === undefined) return "text-muted-foreground";
	if (percent >= 80) return "text-success";
	if (percent < 50) return "text-danger";
	return "text-foreground";
}

function PercentBar({ percent }: { percent?: number }) {
	return (
		<div className="h-1 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
			<div
				className={cn("h-full rounded-full", percent !== undefined && percent < 50 ? "bg-danger" : "bg-primary")}
				style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
			/>
		</div>
	);
}

function CourseGrades({ course }: { course: MoodleCourseGrades }) {
	const percent = coursePercent(course);
	const graded = course.items.filter((i) => i.grade !== undefined).length;

	return (
		<Collapsible className="overflow-hidden rounded-xl border bg-card">
			<CollapsibleTrigger className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
				<span
					className="h-9 w-1 shrink-0 rounded-full"
					style={{ background: `oklch(0.68 0.15 ${courseHue(course.courseId)})` }}
					aria-hidden="true"
				/>
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium">{course.courseName}</p>
					<p className="text-xs text-muted-foreground tabular-nums">
						{graded} of {course.items.length} items graded
					</p>
				</div>
				<span className={cn("text-lg font-semibold tabular-nums", toneOf(percent))}>
					{percent !== undefined ? `${Math.round(percent)}%` : "—"}
				</span>
				<ChevronDown
					className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-180"
					aria-hidden="true"
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
				<div className="max-h-96 overflow-y-auto border-t">
					<Table>
						<TableHeader className="sticky top-0 bg-card">
							<TableRow>
								<TableHead className="pl-4">Item</TableHead>
								<TableHead className="text-right">Grade</TableHead>
								<TableHead className="hidden w-24 sm:table-cell" />
								<TableHead className="pr-4 text-right">Letter</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{course.items.map((item) => {
								const p = itemPercent(item);
								return (
									<TableRow key={item.id}>
										<TableCell className="max-w-0 truncate pl-4">{item.itemName}</TableCell>
										<TableCell className="text-right tabular-nums">
											{item.grade !== undefined ? `${item.grade}/${item.maxGrade ?? "—"}` : "—"}
										</TableCell>
										<TableCell className="hidden sm:table-cell">
											<PercentBar percent={p} />
										</TableCell>
										<TableCell className="pr-4 text-right">{item.letterGrade ?? "—"}</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export default function GradesPage() {
	const { client, refresh } = useMoodleConnection();
	const { prefs } = usePreferences();
	const grades = useMoodleQuery(client ? () => client.getGrades() : null, [client]);
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);

	const currentGrades = useMemo(() => {
		if (!grades.data || !courses.data) return undefined;
		const ids = new Set(courses.data.filter(isCurrentCourse).map((c) => c.id));
		return grades.data.filter((g) => ids.has(g.courseId));
	}, [grades.data, courses.data]);
	const trend = useMemo(() => (currentGrades ? buildGradeTrend(currentGrades) : []), [currentGrades]);

	const percents = (currentGrades ?? []).map(coursePercent).filter((p): p is number => p !== undefined);
	const overall = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : undefined;

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Grades"
				description={
					overall !== undefined ? `Averaging ${overall}% across ${percents.length} active courses` : undefined
				}
			/>

			{grades.loading && <ListSkeleton rows={4} />}
			{grades.error && <ErrorState error={grades.error} onRetry={refresh} />}
			{currentGrades && currentGrades.length === 0 && (
				<EmptyState icon={GraduationCap} title="No grades yet" description="Grades from your active courses show up here." />
			)}

			{trend.length > 1 && (
				<section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
					<div className="flex items-baseline justify-between">
						<h2 className="text-sm font-medium">Weekly average</h2>
						<span className="text-xs text-muted-foreground">Last {trend.length} weeks with grades</span>
					</div>
					<div className="h-48">
						<AreaChart data={trend} config={{ average: { label: "Weekly average", color: ACCENTS[prefs.accent].chart } }}>
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

			{currentGrades && currentGrades.length > 0 && (
				<div className="flex flex-col gap-3">
					{currentGrades.map((course, i) => (
						<div
							key={course.courseId}
							className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 fill-mode-backwards duration-300 ease-out"
							style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
						>
							<CourseGrades course={course} />
						</div>
					))}
				</div>
			)}
		</div>
	);
}
