"use client";

import { useEffect, useMemo } from "react";
import { RichContent } from "@/components/content/rich-content";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { ErrorState, ListSkeleton } from "@/components/ui/state";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { quizAnswerData } from "@/lib/moodle/normalize-quiz";
import type { Quiz, QuizNavItem } from "@/types/quiz";
import { QuestionCard } from "./question-card";
import { formatMark, moodleQuizUrls } from "./quiz-format";
import { QuizNav } from "./quiz-nav";

const noop = () => {};

/** A finished attempt: summary, overall feedback and every question, shown as far as the quiz's review options allow. */
export function AttemptReview({ quiz, attemptId }: { quiz: Quiz; attemptId: number }) {
	const { client, connection, refresh } = useMoodleConnection();
	const review = useMoodleQuery(client ? () => client.getQuizAttemptReview(attemptId) : null, [client, attemptId]);
	const options = useMoodleQuery(client ? () => client.getQuizReviewOptions(quiz.id).catch(() => null) : null, [client, quiz.id]);
	const grade = review.data?.grade !== undefined ? Number(review.data.grade) : undefined;
	const feedback = useMoodleQuery(
		client && grade !== undefined && !Number.isNaN(grade) && options.data?.overallFeedback ? () => client.getQuizFeedback(quiz.id, grade).catch(() => "") : null,
		[client, quiz.id, grade, options.data?.overallFeedback],
	);

	useEffect(() => {
		void client?.logQuizAttemptReview(attemptId);
	}, [client, attemptId]);

	const questions = review.data?.questions;
	const values = useMemo(() => quizAnswerData(questions ?? [], {}), [questions]);
	const nav = useMemo<QuizNavItem[]>(
		() => (questions ?? []).map((q) => ({ slot: q.slot, page: 0, number: q.number ?? "", state: q.state, statusLabel: q.stateLabel, flagged: q.flagged, answerable: q.number !== undefined })),
		[questions],
	);

	if (review.error) return <ErrorState error={review.error} onRetry={refresh} />;
	if (!review.data || !questions) return <ListSkeleton rows={4} />;

	const fallbackUrl = connection ? moodleQuizUrls(connection.siteUrl, quiz.cmid, attemptId).review : undefined;
	const scrollTo = (item: QuizNavItem) => document.getElementById(`question-${item.slot}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

	return (
		<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
			<div className="flex min-w-0 flex-col gap-4">
				{(review.data.summary.length > 0 || review.data.grade !== undefined) && (
					<section className="rounded-xl border bg-card p-4">
						<dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
							{review.data.summary.map((row) => (
								<div key={row.label} className="flex flex-col">
									<dt className="text-xs text-muted-foreground">{row.label}</dt>
									<dd>{row.value}</dd>
								</div>
							))}
						</dl>
						{review.data.grade !== undefined && !Number.isNaN(grade) && (
							<p className="mt-3 border-t pt-3 text-2xl font-medium tabular-nums">
								{formatMark(grade ?? 0, quiz.decimalPoints)} <span className="text-base text-muted-foreground">/ {formatMark(quiz.maxGrade, quiz.decimalPoints)}</span>
							</p>
						)}
						{feedback.data && <RichContent html={feedback.data} className="mt-2" />}
					</section>
				)}
				{questions.map((q) => (
					<QuestionCard key={q.slot} question={q} values={values} onChange={noop} review flagged={q.flagged} fallbackUrl={fallbackUrl} />
				))}
			</div>
			<aside className="lg:sticky lg:top-20">
				<QuizNav items={nav} onSelect={scrollTo} />
			</aside>
		</div>
	);
}
