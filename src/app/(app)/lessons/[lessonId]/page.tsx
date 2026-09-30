"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useLesson } from "@/hooks/use-lesson";
import { PageHeader } from "@/components/layout/page-header";
import { LessonRunner } from "@/components/lesson/lesson-runner";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";

function LessonContent({ lessonId }: { lessonId: number }) {
	const courseId = Number(useSearchParams().get("course")) || null;
	const { data: lesson, loading, error } = useLesson(lessonId, courseId);

	return (
		<div className="flex flex-col gap-6">
			<Link href={courseId ? `/courses/${courseId}` : "/courses"} className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				Back to course
			</Link>
			<PageHeader title={lesson?.name ?? "Lesson"} />
			{error ? (
				<ErrorState error={error} />
			) : loading ? (
				<ListSkeleton rows={3} />
			) : lesson ? (
				<LessonRunner lesson={lesson} />
			) : (
				<EmptyState title="Lesson not found" description="It may have been removed, or you may not have access." />
			)}
		</div>
	);
}

export default function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
	const { lessonId } = use(params);
	return (
		<FeatureGate
			feature="Lessons"
			functions={["mod_lesson_get_lessons_by_courses", "mod_lesson_launch_attempt", "mod_lesson_get_page_data", "mod_lesson_process_page", "mod_lesson_finish_attempt", "mod_lesson_get_pages"]}
		>
			<Suspense fallback={<ListSkeleton rows={3} />}>
				<LessonContent lessonId={Number(lessonId)} />
			</Suspense>
		</FeatureGate>
	);
}
