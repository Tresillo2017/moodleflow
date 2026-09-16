import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MoodleCourse } from "@/types/moodle";

export function CourseCard({ course }: { course: MoodleCourse }) {
	return (
		<Link href={`/courses/${course.id}`}>
			<Card className="h-full transition-colors hover:border-primary/40">
				<CardHeader className="pb-2">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{course.shortName}
					</p>
					<h3 className="text-sm font-semibold leading-snug">{course.fullName}</h3>
				</CardHeader>
				<CardContent className="flex flex-col gap-1.5">
					<Progress value={course.progress ?? 0} className="h-1.5" />
					<p className="text-xs text-muted-foreground">
						{course.progress !== undefined ? `${course.progress}% complete` : "No progress data"}
					</p>
				</CardContent>
			</Card>
		</Link>
	);
}
