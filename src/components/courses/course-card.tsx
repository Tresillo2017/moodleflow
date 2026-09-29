"use client";

import Link from "next/link";
import { Pin, Star } from "lucide-react";
import { CourseContextMenu } from "@/components/courses/course-context-menu";
import { usePinnedCourses } from "@/hooks/use-pinned-courses";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { courseHue } from "@/lib/format";
import type { MoodleCourse } from "@/types/moodle";

export function CourseCard({ course }: { course: MoodleCourse }) {
	const hue = courseHue(course.id);
	const { isPinned } = usePinnedCourses();
	return (
		<CourseContextMenu course={course}>
		<Link
			href={`/courses/${course.id}`}
			className="group rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
		>
			<Card className="h-full gap-0 py-0 transition-[translate,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-primary/40 group-active:translate-y-0">
				<div
					className="relative h-20 overflow-hidden"
					style={{ background: `linear-gradient(135deg, oklch(0.62 0.14 ${hue}), oklch(0.45 0.12 ${hue + 40}))` }}
				>
					{course.imageUrl && (
						// eslint-disable-next-line @next/next/no-img-element -- arbitrary Moodle hosts
						<img
							src={course.imageUrl}
							alt=""
							loading="lazy"
							onError={(e) => {
								e.currentTarget.hidden = true;
							}}
							className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
						/>
					)}
					<span className="absolute bottom-2 left-3 rounded-md bg-black/35 px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-white backdrop-blur-sm">
						{course.shortName}
					</span>
					{isPinned(course.id) && (
						<Pin className="absolute top-2.5 left-2.5 size-4 fill-white text-white drop-shadow" aria-label="Pinned" />
					)}
					{course.isFavourite && (
						<Star className="absolute top-2.5 right-2.5 size-4 fill-white text-white drop-shadow" aria-label="Starred" />
					)}
				</div>
				<div className="flex flex-1 flex-col gap-3 p-4">
					<h3 className="line-clamp-2 text-sm leading-snug font-semibold">{course.fullName}</h3>
					<div className="mt-auto flex flex-col gap-1.5">
						<Progress value={course.progress ?? 0} className="h-1.5" />
						<p className="text-xs text-muted-foreground tabular-nums">
							{course.progress !== undefined ? `${course.progress}% complete` : "No progress data"}
						</p>
					</div>
				</div>
			</Card>
		</Link>
		</CourseContextMenu>
	);
}
