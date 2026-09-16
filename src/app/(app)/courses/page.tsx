"use client";

import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { CourseCard } from "@/components/courses/course-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { NotebookText } from "lucide-react";

export default function CoursesPage() {
	const { client } = useMoodleConnection();
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);

	return (
		<div className="flex flex-col gap-6">
			<h1 className="text-2xl font-semibold tracking-tight">My Courses</h1>

			{courses.loading && <ListSkeleton rows={4} />}
			{courses.error && <ErrorState error={courses.error} onRetry={() => location.reload()} />}
			{courses.data && courses.data.length === 0 && (
				<EmptyState icon={NotebookText} title="No courses yet" description="You're not enrolled in any courses." />
			)}
			{courses.data && courses.data.length > 0 && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{courses.data.map((c) => (
						<CourseCard key={c.id} course={c} />
					))}
				</div>
			)}
		</div>
	);
}
