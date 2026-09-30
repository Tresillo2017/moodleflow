"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, MessageSquare, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RichContent } from "@/components/content/rich-content";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { LessonPageForm } from "@/components/lesson/lesson-page-form";
import { nextLessonPageId } from "@/lib/moodle/normalize-lesson";
import { toast } from "@/lib/toast";
import { MoodleError } from "@/types/moodle";
import { LESSON_EOL } from "@/types/lesson";
import type { LessonFinish, LessonInfo, LessonInput, LessonPage, LessonPageResult } from "@/types/lesson";

export const errorMessage = (e: unknown) => (e instanceof MoodleError ? e.message : "Something went wrong.");

interface Props {
	lesson: LessonInfo;
	startPageId: number;
	password?: string;
	onFinished: (result: LessonFinish) => void;
}

/** Walks the learner through the lesson: page, feedback, next page, until Moodle says the lesson is over. */
export function LessonPlayer({ lesson, startPageId, password, onFinished }: Props) {
	const { client, connection } = useMoodleConnection();
	const [page, setPage] = useState<LessonPage | null>(null);
	const [loadCount, setLoadCount] = useState(0);
	const [error, setError] = useState<MoodleError | null>(null);
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<LessonPageResult | null>(null);
	const [score, setScore] = useState<string>();

	const finish = useCallback(async () => {
		if (!client) return;
		try {
			onFinished(await client.finishLesson(lesson.id, { password }));
		} catch (e) {
			toast.error("Couldn't finish the lesson", { description: errorMessage(e) });
		}
	}, [client, lesson.id, password, onFinished]);

	const load = useCallback(
		async (pageId: number) => {
			if (!client) return;
			if (pageId === LESSON_EOL) return finish();
			setBusy(true);
			try {
				const next = await client.getLessonPage(lesson.id, pageId, { password });
				setPage(next);
				setScore((s) => next.ongoingScore ?? s);
				setLoadCount((n) => n + 1);
				setError(null);
			} catch (e) {
				setError(e instanceof MoodleError ? e : new MoodleError("unknown_error", errorMessage(e)));
			} finally {
				setBusy(false);
			}
		},
		[client, lesson.id, password, finish],
	);

	useEffect(() => {
		void load(startPageId);
		// only on mount: later pages are loaded by the learner's actions
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [client]);

	async function submit(input: LessonInput) {
		if (!client || !page) return;
		setBusy(true);
		try {
			const result = await client.submitLessonPage(lesson.id, page, input, { password });
			if (result.noAnswer) {
				toast.warning("Please answer the question first");
				return;
			}
			setScore((s) => result.ongoingScore ?? s);
			if (result.feedback || result.response) {
				setFeedback(result);
				return;
			}
			await load(nextLessonPageId(result.newPageId, page));
		} catch (e) {
			toast.error("Couldn't submit your answer", { description: errorMessage(e) });
		} finally {
			setBusy(false);
		}
	}

	async function proceed() {
		if (!page || !feedback) return;
		const target = nextLessonPageId(feedback.newPageId, page);
		setFeedback(null);
		await load(target);
	}

	if (error) return <ErrorState error={error} onRetry={() => void load(page?.id ?? startPageId)} />;
	if (!page) return <ListSkeleton rows={3} />;

	const showProgress = lesson.progressBar && page.progress != null;
	const retrying = feedback != null && nextLessonPageId(feedback.newPageId, page) === page.id;
	return (
		<div className="flex flex-col gap-4">
			{(showProgress || (lesson.ongoingScore && score)) && (
				<div className="flex items-center gap-3">
					{showProgress && <Progress value={page.progress ?? null} className="flex-1" aria-label="Lesson progress" />}
					{lesson.ongoingScore && score && <Badge variant="secondary">Score {score}</Badge>}
				</div>
			)}
			<h2 className="text-xl font-medium">{page.title}</h2>
			{page.messages.map((m) => (
				<RichContent key={m} html={m} className="rounded-lg border bg-muted/40 p-3" />
			))}

			{page.kind === "unknown" ? (
				<EmptyState
					title="This page type isn't supported here yet"
					description="Continue this part of the lesson in Moodle."
					action={
						connection && (
							<a href={`${connection.siteUrl.replace(/\/$/, "")}/mod/lesson/view.php?id=${lesson.cmid}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
								Open in Moodle
								<ExternalLink aria-hidden="true" />
							</a>
						)
					}
				/>
			) : feedback ? (
				<Feedback result={feedback} retrying={retrying} busy={busy} onContinue={() => void proceed()} />
			) : (
				<LessonPageForm key={`${page.id}-${loadCount}`} page={page} busy={busy} onSubmit={(input) => void submit(input)} />
			)}
		</div>
	);
}

function Feedback({ result, retrying, busy, onContinue }: { result: LessonPageResult; retrying: boolean; busy: boolean; onContinue: () => void }) {
	const Icon = result.essay ? MessageSquare : result.correct ? CheckCircle2 : XCircle;
	const tone = result.essay ? "text-muted-foreground" : result.correct ? "text-success" : "text-danger";
	return (
		<div className="flex flex-col gap-3 rounded-xl border bg-card p-4" role="status">
			<Icon className={`size-6 ${tone}`} aria-hidden="true" />
			{result.feedback && <RichContent html={result.feedback} />}
			{result.response && <RichContent html={result.response} />}
			{retrying && result.attemptsRemaining > 0 && <p className="text-xs text-muted-foreground">Attempts remaining: {result.attemptsRemaining}</p>}
			<div>
				<Button disabled={busy} onClick={onContinue}>
					{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
					{retrying ? "Try again" : "Continue"}
				</Button>
			</div>
		</div>
	);
}
