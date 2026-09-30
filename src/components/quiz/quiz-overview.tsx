"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { RichContent } from "@/components/content/rich-content";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, ListSkeleton } from "@/components/ui/state";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useSupports } from "@/hooks/use-supports";
import { SUPPORTED_QTYPES } from "@/lib/moodle/normalize-quiz-question";
import { toast } from "@/lib/toast";
import type { Quiz } from "@/types/quiz";
import { AttemptsTable } from "./attempts-table";
import { formatDateTime, formatDuration, formatMark, GRADE_METHOD_LABEL, moodleQuizUrls } from "./quiz-format";

const TAKE_FUNCTIONS = [
	"mod_quiz_start_attempt",
	"mod_quiz_get_attempt_data",
	"mod_quiz_save_attempt",
	"mod_quiz_process_attempt",
	"mod_quiz_get_attempt_summary",
	"mod_quiz_get_attempt_access_information",
];

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col">
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd>{children}</dd>
		</div>
	);
}

/** Landing page body: rules, attempts, best grade with feedback, and the start/continue action. */
export function QuizOverview({ quiz, courseId }: { quiz: Quiz; courseId: number }) {
	const { client, connection, refresh } = useMoodleConnection();
	const router = useRouter();
	const canTake = useSupports(...TAKE_FUNCTIONS);
	const [password, setPassword] = useState("");
	const [starting, setStarting] = useState(false);

	const access = useMoodleQuery(client ? () => client.getQuizAccess(quiz.id) : null, [client, quiz.id]);
	const attempts = useMoodleQuery(client ? () => client.getQuizAttempts(quiz.id) : null, [client, quiz.id]);
	// the rest is nice to have: a site missing one of these shouldn't break the page
	const best = useMoodleQuery(client ? () => client.getQuizBestGrade(quiz.id).catch(() => null) : null, [client, quiz.id]);
	const options = useMoodleQuery(client ? () => client.getQuizReviewOptions(quiz.id).catch(() => null) : null, [client, quiz.id]);
	const qtypes = useMoodleQuery(client ? () => client.getQuizRequiredQtypes(quiz.id) : null, [client, quiz.id]);
	const bestGrade = best.data?.hasGrade ? best.data.grade : undefined;
	const feedback = useMoodleQuery(
		client && bestGrade !== undefined && options.data?.overallFeedback ? () => client.getQuizFeedback(quiz.id, bestGrade).catch(() => "") : null,
		[client, quiz.id, bestGrade, options.data?.overallFeedback],
	);

	const error = access.error ?? attempts.error;
	if (error) return <ErrorState error={error} onRetry={refresh} />;
	if (!access.data || !attempts.data) return <ListSkeleton rows={3} />;

	const acc = access.data;
	const { blockedReasons } = acc;
	const list = attempts.data;
	const open = list.find((a) => a.state === "inprogress" || a.state === "overdue");
	const unsupported = (qtypes.data ?? []).filter((t) => !SUPPORTED_QTYPES.has(t));
	const canStart = !open && quiz.hasQuestions && acc.canAttempt && blockedReasons.length === 0 && acc.newAttemptBlockedReasons.length === 0;
	const takePath = (attemptId: number) => `/quizzes/${quiz.id}/attempt/${attemptId}?course=${courseId}`;
	const moodleUrl = connection ? moodleQuizUrls(connection.siteUrl, quiz.cmid).quiz : undefined;
	const reasons = [...blockedReasons, ...(open ? [] : acc.newAttemptBlockedReasons)];

	async function start() {
		if (!client) return;
		setStarting(true);
		try {
			const attempt = await client.startQuizAttempt(quiz.id, password || undefined);
			router.push(takePath(attempt.id));
		} catch (e) {
			toast.error(e instanceof Error && e.message ? e.message : "Couldn't start the attempt.");
			setStarting(false);
		}
	}

	return (
		<div className="flex flex-col gap-6">
			{quiz.intro && <RichContent html={quiz.intro} className="rounded-xl border bg-card p-4" />}

			<section className="rounded-xl border bg-card p-4">
				<dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
					{quiz.timeOpen && <Fact label="Opens">{formatDateTime(quiz.timeOpen)}</Fact>}
					{quiz.timeClose && <Fact label="Closes">{formatDateTime(quiz.timeClose)}</Fact>}
					{quiz.timeLimit && <Fact label="Time limit">{formatDuration(quiz.timeLimit)}</Fact>}
					<Fact label="Attempts allowed">{quiz.maxAttempts > 0 ? quiz.maxAttempts : "Unlimited"}</Fact>
					<Fact label="Grading method">{GRADE_METHOD_LABEL[quiz.gradeMethod]}</Fact>
					<Fact label="Maximum grade">{formatMark(quiz.maxGrade, quiz.decimalPoints)}</Fact>
				</dl>
				{acc.rules.length > 0 && (
					<ul className="mt-3 flex list-disc flex-col gap-1 border-t pt-3 pl-5 text-sm text-muted-foreground">
						{acc.rules.map((rule) => (
							<li key={rule}>{rule}</li>
						))}
					</ul>
				)}
			</section>

			{unsupported.length > 0 && (
				<Alert>
					<AlertTitle>Some questions need Moodle</AlertTitle>
					<AlertDescription>
						This quiz uses question types MoodleFlow can't show ({unsupported.join(", ")}). Those questions are shown read-only; answer them in Moodle.
					</AlertDescription>
				</Alert>
			)}
			{reasons.length > 0 && (
				<Alert>
					<AlertTitle>You can't attempt this quiz right now</AlertTitle>
					<AlertDescription>{reasons.join(" ")}</AlertDescription>
				</Alert>
			)}

			{list.length > 0 && (
				<section className="flex flex-col gap-2">
					<h2 className="text-lg font-medium">Your attempts</h2>
					<AttemptsTable quiz={quiz} attempts={list} options={options.data} courseId={courseId} />
				</section>
			)}
			{bestGrade !== undefined && options.data?.marks && (
				<section className="rounded-xl border bg-card p-4">
					<p className="text-sm text-muted-foreground">{GRADE_METHOD_LABEL[quiz.gradeMethod]}</p>
					<p className="text-2xl font-medium tabular-nums">
						{formatMark(bestGrade, quiz.decimalPoints)} <span className="text-base text-muted-foreground">/ {formatMark(quiz.maxGrade, quiz.decimalPoints)}</span>
					</p>
					{feedback.data && <RichContent html={feedback.data} className="mt-2" />}
				</section>
			)}

			{!quiz.hasQuestions && <p className="text-sm text-muted-foreground">This quiz doesn't have any questions yet.</p>}
			{!canTake && (
				<Alert>
					<AlertTitle>Attempts aren't available from MoodleFlow</AlertTitle>
					<AlertDescription>Your site doesn't expose the quiz attempt functions to the mobile web service. Use Moodle to take this quiz.</AlertDescription>
				</Alert>
			)}
			<div className="flex flex-wrap items-center gap-3">
				{canTake && open && (
					<Button nativeButton={false} render={<Link href={takePath(open.id)} />}>
						{open.state === "overdue" ? "Submit overdue attempt" : "Continue your attempt"}
					</Button>
				)}
				{canTake && canStart && (
					<form
						className="flex flex-wrap items-center gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							void start();
						}}
					>
						{acc.requiresPassword && <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Quiz password" aria-label="Quiz password" autoComplete="off" className="w-48" required />}
						<Button type="submit" disabled={starting}>
							{starting && <Loader2 className="animate-spin" aria-hidden="true" />}
							{list.length > 0 ? "Re-attempt quiz" : "Attempt quiz now"}
						</Button>
					</form>
				)}
				{moodleUrl && (
					<a href={moodleUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
						Open in Moodle
						<ExternalLink className="size-3" aria-hidden="true" />
					</a>
				)}
			</div>
		</div>
	);
}
