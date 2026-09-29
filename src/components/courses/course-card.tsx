"use client";

import Link from "next/link";
import { CheckCircle2, Pin, Star } from "lucide-react";
import { CourseBanner } from "@/components/courses/course-banner";
import { CourseContextMenu } from "@/components/courses/course-context-menu";
import { usePinnedCourses } from "@/hooks/use-pinned-courses";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MoodleCourse } from "@/types/moodle";

export function CourseCard({ course }: { course: MoodleCourse }) {
	const { isPinned } = usePinnedCourses();
	return (
		<CourseContextMenu course={course}>
		<Link
			href={`/courses/${course.id}`}
			className="group rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
		>
			<Card className="h-full gap-0 py-0 transition-[translate,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-primary/40 group-active:translate-y-0">
				<CourseBanner course={course} className="h-28">
					<div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" aria-hidden="true" />
					<span className="absolute bottom-2.5 left-3 rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-white ring-1 ring-white/25 backdrop-blur-md">
						{course.shortName}
					</span>
					<div className="absolute top-2.5 right-2.5 flex gap-1.5">
						{isPinned(course.id) && <Pin className="size-4 fill-white text-white drop-shadow" aria-label="Pinned" />}
						{course.isFavourite && <Star className="size-4 fill-white text-white drop-shadow" aria-label="Starred" />}
					</div>
				</CourseBanner>
				<div className="flex flex-1 flex-col gap-3 p-4">
					<h3 className="line-clamp-2 min-h-[2.5em] text-sm leading-snug font-semibold">{course.fullName}</h3>
					<div className="mt-auto flex flex-col gap-1.5">
						<Progress value={course.progress ?? 0} className="h-1.5" />
						<p className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
							<span>{course.progress !== undefined ? `${course.progress}% complete` : "No progress data"}</span>
							{course.progress === 100 && (
								<span className="flex items-center gap-1 text-success">
									<CheckCircle2 className="size-3.5" aria-hidden="true" />
									Done
								</span>
							)}
						</p>
					</div>
				</div>
			</Card>
		</Link>
		</CourseContextMenu>
	);
}
