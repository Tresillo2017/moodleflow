"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { courseHue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MoodleCourseGrades, MoodleGradeItem } from "@/types/moodle";

function itemPercent(item: MoodleGradeItem): number | undefined {
	if (item.percentage !== undefined) return item.percentage;
	if (item.grade === undefined || !item.maxGrade) return undefined;
	return (item.grade / item.maxGrade) * 100;
}

export function coursePercent(course: MoodleCourseGrades): number | undefined {
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

export function CourseGrades({ course }: { course: MoodleCourseGrades }) {
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
