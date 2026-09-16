"use client";

import { use } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { Progress } from "@/components/ui/progress";
import { ActivityIcon } from "@/components/activities/activity-icon";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { CheckCircle2, Circle, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
	const { courseId } = use(params);
	const id = Number(courseId);
	const { client } = useMoodleConnection();

	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const content = useMoodleQuery(client ? () => client.getCourseContents(id) : null, [client, id]);
	const course = courses.data?.find((c) => c.id === id);

	return (
		<div className="flex flex-col gap-6">
			<div>
				{course ? (
					<>
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							{course.shortName}
						</p>
						<h1 className="text-2xl font-semibold tracking-tight">{course.fullName}</h1>
						<div className="mt-3 flex max-w-xs items-center gap-3">
							<Progress value={course.progress ?? 0} className="h-1.5" />
							<span className="shrink-0 text-xs text-muted-foreground">{course.progress ?? 0}% complete</span>
						</div>
					</>
				) : (
					<div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
				)}
			</div>

			{content.loading && <ListSkeleton rows={4} />}
			{content.error && <ErrorState error={content.error} />}
			{content.data && content.data.sections.length === 0 && (
				<EmptyState icon={FolderOpen} title="No content yet" description="This course has no published sections." />
			)}

			<div className="flex flex-col gap-6">
				{content.data?.sections.map((section) => (
					<div key={section.id} className="flex flex-col gap-2">
						<h2 className="text-sm font-medium text-muted-foreground">{section.name}</h2>
						<div className="flex flex-col divide-y rounded-lg border">
							{section.activities.map((a) => (
								<div key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
									{a.completed === undefined ? (
										<span className="size-4 shrink-0" />
									) : a.completed ? (
										<CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
									) : (
										<Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									)}
									<ActivityIcon
										type={a.type}
										className={cn("size-4 shrink-0 text-muted-foreground")}
									/>
									<span className="flex-1 truncate">{a.name}</span>
									<DeadlineBadge dueDate={a.dueDate} />
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
