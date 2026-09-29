"use client";

import { useMemo } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { GraduationCap } from "lucide-react";
import { CourseGrades, coursePercent } from "@/components/grades/course-grades";
import { AreaChart } from "@/components/dither-kit/area-chart";
import { Area } from "@/components/dither-kit/area";
import { Grid } from "@/components/dither-kit/grid";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import { buildGradeTrend } from "@/lib/moodle/grade-trend";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { ACCENTS } from "@/lib/preferences";

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
