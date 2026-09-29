"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { courseHue } from "@/lib/format";
import { coursePercent, itemPercent } from "@/lib/moodle/grade-stats";
import { cn } from "@/lib/utils";
import type { MoodleCourseGrades, MoodleGradeItem } from "@/types/moodle";

function toneOf(percent: number | undefined): string {
	if (percent === undefined) return "text-muted-foreground";
	if (percent >= 80) return "text-success";
	if (percent < 50) return "text-danger";
	return "text-foreground";
}

function PercentBar({ percent, className }: { percent?: number; className?: string }) {
	return (
		<div className={cn("h-1.5 w-16 overflow-hidden rounded-full bg-muted", className)} aria-hidden="true">
			<div
				className={cn("h-full rounded-full", percent !== undefined && percent < 50 ? "bg-danger" : percent !== undefined && percent >= 80 ? "bg-success" : "bg-primary")}
				style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
			/>
		</div>
	);
}

export function CourseGrades({
	course,
	query = "",
	defaultOpen = false,
}: {
	course: MoodleCourseGrades;
	/** Only items whose name contains this text are listed (the whole course when the course name matches). */
	query?: string;
	defaultOpen?: boolean;
}) {
	const percent = coursePercent(course);
	const needle = query.trim().toLowerCase();
	const items = !needle || course.courseName.toLowerCase().includes(needle)
		? course.items
		: course.items.filter((i) => i.itemName.toLowerCase().includes(needle));
	const graded = course.items.filter((i) => i.grade !== undefined).length;

	return (
		<Collapsible defaultOpen={defaultOpen} className="overflow-hidden rounded-xl border bg-card">
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
				<div className="hidden w-28 sm:block">
					<PercentBar percent={percent} className="w-full" />
				</div>
				<span className={cn("w-12 text-right text-lg font-semibold tabular-nums", toneOf(percent))}>
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
								<TableHead className="hidden text-right md:table-cell">Graded</TableHead>
								<TableHead className="pr-4 text-right">Letter</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.length === 0 && (
								<TableRow>
									<TableCell colSpan={5} className="pl-4 text-muted-foreground">No items match.</TableCell>
								</TableRow>
							)}
							{items.map((item) => {
								const p = itemPercent(item);
								return (
									<TableRow key={item.id}>
										<TableCell className="max-w-0 pl-4">
											<span className="block truncate">{item.itemName}</span>
											{item.feedback && (
												<RichContent html={item.feedback} className="line-clamp-2 text-xs text-muted-foreground [&_p]:my-0" />
											)}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{item.grade !== undefined ? `${item.grade}/${item.maxGrade ?? "—"}` : "—"}
										</TableCell>
										<TableCell className="hidden sm:table-cell">
											<PercentBar percent={p} />
										</TableCell>
										<TableCell className="hidden text-right text-xs text-muted-foreground md:table-cell">
											{item.gradedDate ? new Date(item.gradedDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
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
