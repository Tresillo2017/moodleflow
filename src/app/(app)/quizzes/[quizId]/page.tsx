"use client";

import { Suspense, use, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useQuiz } from "@/hooks/use-quiz";
import { PageHeader } from "@/components/layout/page-header";
import { QuizOverview } from "@/components/quiz/quiz-overview";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";

function QuizContent({ quizId }: { quizId: number }) {
	const { client, refresh } = useMoodleConnection();
	const courseParam = Number(useSearchParams().get("course")) || null;
	const quiz = useQuiz(quizId, courseParam);
	useEffect(() => {
		void client?.logActivityView({ type: "quiz", instance: quizId });
	}, [client, quizId]);

	const q = quiz.data;
	const courseId = courseParam ?? q?.courseId;
	return (
		<div className="flex flex-col gap-6">
			<Link href={courseId ? `/courses/${courseId}` : "/courses"} className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				Back to course
			</Link>
			<PageHeader title={q?.name ?? "Quiz"} />
			{quiz.loading && <ListSkeleton rows={3} />}
			{quiz.error && <ErrorState error={quiz.error} onRetry={refresh} />}
			{quiz.data === null && <EmptyState title="Quiz not found" description="It may have been removed, or you may not have access to it." />}
			{q && <QuizOverview quiz={q} courseId={q.courseId} />}
		</div>
	);
}

export default function QuizPage({ params }: { params: Promise<{ quizId: string }> }) {
	const { quizId } = use(params);
	return (
		<FeatureGate feature="Quizzes" functions={["mod_quiz_get_quizzes_by_courses", "mod_quiz_get_user_attempts"]}>
			<Suspense fallback={<ListSkeleton rows={4} />}>
				<QuizContent quizId={Number(quizId)} />
			</Suspense>
		</FeatureGate>
	);
}
