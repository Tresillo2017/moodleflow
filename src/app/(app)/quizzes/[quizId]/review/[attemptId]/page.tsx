"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useQuiz } from "@/hooks/use-quiz";
import { PageHeader } from "@/components/layout/page-header";
import { AttemptReview } from "@/components/quiz/attempt-review";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";

function ReviewContent({ quizId, attemptId }: { quizId: number; attemptId: number }) {
	const { refresh } = useMoodleConnection();
	const courseParam = Number(useSearchParams().get("course")) || null;
	const quiz = useQuiz(quizId, courseParam);
	const overview = `/quizzes/${quizId}${courseParam ? `?course=${courseParam}` : ""}`;

	return (
		<div className="flex flex-col gap-6">
			<Link href={overview} className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				Back to quiz
			</Link>
			<PageHeader title={quiz.data?.name ?? "Quiz"} eyebrow="Attempt review" />
			{quiz.loading && <ListSkeleton rows={3} />}
			{quiz.error && <ErrorState error={quiz.error} onRetry={refresh} />}
			{quiz.data === null && <EmptyState title="Quiz not found" />}
			{quiz.data && <AttemptReview quiz={quiz.data} attemptId={attemptId} />}
		</div>
	);
}

export default function QuizReviewPage({ params }: { params: Promise<{ quizId: string; attemptId: string }> }) {
	const { quizId, attemptId } = use(params);
	return (
		<FeatureGate feature="Quiz review" functions={["mod_quiz_get_attempt_review"]}>
			<Suspense fallback={<ListSkeleton rows={4} />}>
				<ReviewContent quizId={Number(quizId)} attemptId={Number(attemptId)} />
			</Suspense>
		</FeatureGate>
	);
}
