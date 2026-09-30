"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useQuiz } from "@/hooks/use-quiz";
import { PageHeader } from "@/components/layout/page-header";
import { AttemptRunner } from "@/components/quiz/attempt-runner";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { useMoodleConnection } from "@/components/providers/moodle-provider";

const ATTEMPT_FUNCTIONS = [
	"mod_quiz_get_attempt_data",
	"mod_quiz_save_attempt",
	"mod_quiz_process_attempt",
	"mod_quiz_get_attempt_summary",
	"mod_quiz_get_attempt_access_information",
];

function AttemptContent({ quizId, attemptId }: { quizId: number; attemptId: number }) {
	const { refresh } = useMoodleConnection();
	const router = useRouter();
	const courseParam = Number(useSearchParams().get("course")) || null;
	const quiz = useQuiz(quizId, courseParam);
	const overview = `/quizzes/${quizId}${courseParam ? `?course=${courseParam}` : ""}`;

	return (
		<div className="flex flex-col gap-6">
			<Link href={overview} className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				Back to quiz (your answers are saved)
			</Link>
			<PageHeader title={quiz.data?.name ?? "Quiz"} />
			{quiz.loading && <ListSkeleton rows={3} />}
			{quiz.error && <ErrorState error={quiz.error} onRetry={refresh} />}
			{quiz.data === null && <EmptyState title="Quiz not found" />}
			{quiz.data && <AttemptRunner quiz={quiz.data} attemptId={attemptId} onFinished={() => router.replace(overview)} />}
		</div>
	);
}

export default function QuizAttemptPage({ params }: { params: Promise<{ quizId: string; attemptId: string }> }) {
	const { quizId, attemptId } = use(params);
	return (
		<FeatureGate feature="Quiz attempts" functions={ATTEMPT_FUNCTIONS}>
			<Suspense fallback={<ListSkeleton rows={4} />}>
				<AttemptContent quizId={Number(quizId)} attemptId={Number(attemptId)} />
			</Suspense>
		</FeatureGate>
	);
}
