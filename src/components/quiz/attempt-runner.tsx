"use client";

import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorState, ListSkeleton } from "@/components/ui/state";
import { useQuizAttempt } from "@/hooks/use-quiz-attempt";
import type { Quiz, QuizNavItem } from "@/types/quiz";
import { AttemptSummary } from "./attempt-summary";
import { moodleQuizUrls } from "./quiz-format";
import { QuestionCard } from "./question-card";
import { QuizNav } from "./quiz-nav";
import { QuizTimer } from "./quiz-timer";

const SAVE_LABEL = { idle: "", saving: "Saving...", saved: "Answers saved", error: "Couldn't save. Retrying with your next change." } as const;

const scrollToQuestion = (slot: number) => setTimeout(() => document.getElementById(`question-${slot}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);

/** The take-a-quiz screen: paged questions, navigation panel, timer, autosave and the final summary. */
export function AttemptRunner({ quiz, attemptId, onFinished }: { quiz: Quiz; attemptId: number; onFinished: () => void }) {
	const { connection } = useMoodleConnection();
	const a = useQuizAttempt(quiz.id, attemptId, onFinished);
	const sequential = quiz.navMethod === "sequential";
	const fallbackUrl = connection ? moodleQuizUrls(connection.siteUrl, quiz.cmid, attemptId).attempt : undefined;

	if (a.error) return <ErrorState error={a.error} onRetry={a.retry} />;
	if (!a.ready) return <ListSkeleton rows={4} />;

	const page = a.view?.kind === "page" ? a.view.page : undefined;
	const questions = a.pageData?.questions ?? [];

	async function goToQuestion(item: QuizNavItem) {
		if (item.page !== page) await a.navigate({ kind: "page", page: item.page });
		scrollToQuestion(item.slot);
	}

	const firstUnanswered = a.nav.find((i) => i.answerable && i.state !== "complete");

	return (
		<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
			<div className="flex min-w-0 flex-col gap-4">
				{a.view?.kind === "summary" ? (
					<AttemptSummary
						items={a.nav}
						busy={a.busy}
						onGoTo={(item) => void a.navigate({ kind: "page", page: item.page }).then(() => scrollToQuestion(item.slot))}
						onReturn={() => void a.navigate({ kind: "page", page: firstUnanswered?.page ?? 0 })}
						onSubmit={() => void a.finish()}
					/>
				) : (
					<>
						{a.pageData?.messages.map((m) => (
							<Alert key={m}>
								<AlertDescription>
									<RichContent html={m} />
								</AlertDescription>
							</Alert>
						))}
						{questions.map((q) => (
							<QuestionCard key={`${page}-${q.slot}`} question={q} values={a.values} onChange={a.setAnswer} onToggleFlag={(x) => void a.toggleFlag(x)} flagged={a.isFlagged(q)} fallbackUrl={fallbackUrl} />
						))}
						<div className="flex items-center justify-between gap-2">
							{!sequential && page !== undefined && page > 0 ? (
								<Button variant="outline" disabled={a.busy} onClick={() => void a.navigate({ kind: "page", page: page - 1 })}>
									<ArrowLeft aria-hidden="true" />
									Previous page
								</Button>
							) : (
								<span />
							)}
							{a.pageData && a.pageData.nextPage >= 0 ? (
								<Button disabled={a.busy} onClick={() => void a.navigate({ kind: "page", page: a.pageData?.nextPage ?? 0 })}>
									{a.busy && <Loader2 className="animate-spin" aria-hidden="true" />}
									Next page
									<ArrowRight aria-hidden="true" />
								</Button>
							) : (
								<Button disabled={a.busy} onClick={() => void a.navigate({ kind: "summary" })}>
									{a.busy && <Loader2 className="animate-spin" aria-hidden="true" />}
									Finish attempt...
								</Button>
							)}
						</div>
					</>
				)}
			</div>
			<aside className="flex flex-col gap-3 lg:sticky lg:top-20">
				{a.secondsLeft !== null && <QuizTimer secondsLeft={a.secondsLeft} />}
				<QuizNav items={a.nav} activePage={page} disabled={a.busy || sequential} onSelect={(item) => void goToQuestion(item)} />
				{sequential && <p className="text-xs text-muted-foreground">This quiz only lets you move forward.</p>}
				<Button variant="outline" size="sm" disabled={a.busy || a.view?.kind === "summary"} onClick={() => void a.navigate({ kind: "summary" })}>
					Finish attempt...
				</Button>
				<p className="flex min-h-4 items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
					{a.saveStatus === "saved" && <Check className="size-3 text-success" aria-hidden="true" />}
					{SAVE_LABEL[a.saveStatus]}
				</p>
			</aside>
		</div>
	);
}
