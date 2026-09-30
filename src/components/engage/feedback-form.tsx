"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { RichContent } from "@/components/content/rich-content";
import { Button } from "@/components/ui/button";
import { ErrorState, ListSkeleton } from "@/components/ui/state";
import { FeedbackItemField } from "@/components/engage/feedback-fields";
import { feedbackResponses, invalidNumeric, isItemVisible, missingRequired, seedAnswers } from "@/lib/moodle/normalize-engage";
import { toast } from "@/lib/toast";
import type { Feedback, FeedbackAnswers, FeedbackProcessResult } from "@/types/engage";

interface StepProps {
	feedback: Feedback;
	page: number;
	answers: FeedbackAnswers;
	onAnswers: (answers: FeedbackAnswers) => void;
	onResult: (result: FeedbackProcessResult) => void;
}

/** One page of questions. Remounted per page so it never shows the previous page's items. */
function FeedbackStep({ feedback, page, answers, onAnswers, onResult }: StepProps) {
	const { client, refresh } = useMoodleConnection();
	const query = useMoodleQuery(client ? () => client.getFeedbackPage(feedback.id, page) : null, [client, feedback.id, page]);
	const [invalid, setInvalid] = useState<Set<number>>(new Set());
	const [busy, setBusy] = useState(false);

	if (query.loading) return <ListSkeleton rows={3} />;
	if (query.error) return <ErrorState error={query.error} onRetry={refresh} />;
	if (!query.data || !client) return null;
	const { items, hasPrev, hasNext } = query.data;
	const values = seedAnswers(items, answers);

	async function submit(goPrevious: boolean) {
		if (!client) return;
		if (!goPrevious) {
			const bad = [...missingRequired(items, values), ...invalidNumeric(items, values)];
			setInvalid(new Set(bad));
			if (bad.length) return toast.error("Answer the highlighted questions to continue.");
		}
		setBusy(true);
		try {
			const result = await client.processFeedbackPage(feedback.id, page, feedbackResponses(items, values), goPrevious);
			if (!goPrevious && !result.completed && result.page === page) toast.error("Moodle didn't accept this page. Check your answers.");
			onAnswers(values);
			onResult(result);
		} catch (e) {
			toast.error(e instanceof Error && e.message ? e.message : "Couldn't save your answers. Try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<form
			className="flex flex-col gap-6"
			onSubmit={(e) => {
				e.preventDefault();
				void submit(false);
			}}
		>
			{items.filter((i) => isItemVisible(i, values)).map((item) => (
				<FeedbackItemField
					key={item.id}
					item={item}
					answer={values[item.id] ?? (item.style === "check" ? [] : "")}
					invalid={invalid.has(item.id)}
					onChange={(v) => {
						onAnswers({ ...values, [item.id]: v });
						if (invalid.has(item.id)) setInvalid(new Set([...invalid].filter((id) => id !== item.id)));
					}}
				/>
			))}
			{items.length === 0 && <p className="text-sm text-muted-foreground">This page has no questions.</p>}
			<div className="flex items-center justify-between gap-2 border-t pt-4">
				<Button type="button" variant="outline" disabled={busy || !hasPrev} onClick={() => submit(true)}>
					<ArrowLeft aria-hidden="true" />
					Previous
				</Button>
				<Button type="submit" disabled={busy}>
					{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
					{hasNext ? "Next" : "Submit"}
					{hasNext && <ArrowRight aria-hidden="true" />}
				</Button>
			</div>
		</form>
	);
}

function FeedbackDone({ feedback, result, onClose }: { feedback: Feedback; result: FeedbackProcessResult; onClose: () => void }) {
	const message = result.message ?? feedback.completionMessage;
	const redirect = result.redirectUrl ?? feedback.afterSubmitUrl;
	return (
		<div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
			<CheckCircle2 className="size-8 text-success" aria-hidden="true" />
			<p className="text-sm font-medium">Feedback submitted</p>
			{message ? <RichContent html={message} /> : <p className="text-sm text-muted-foreground">Thanks for taking the time to answer.</p>}
			<div className="flex gap-2">
				<Button variant="outline" onClick={onClose}>
					Back to overview
				</Button>
				{redirect && (
					<Button render={<a href={redirect} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
						Continue
					</Button>
				)}
			</div>
		</div>
	);
}

/** Multi-page completion of a feedback, starting at Moodle's resume page. */
export function FeedbackForm({ feedback, startPage, onClose }: { feedback: Feedback; startPage: number; onClose: () => void }) {
	const [page, setPage] = useState(startPage);
	const [answers, setAnswers] = useState<FeedbackAnswers>({});
	const [done, setDone] = useState<FeedbackProcessResult | null>(null);

	if (done) return <FeedbackDone feedback={feedback} result={done} onClose={onClose} />;
	return (
		<section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
			<p className="text-xs text-muted-foreground">Page {page + 1}</p>
			<FeedbackStep
				key={page}
				feedback={feedback}
				page={page}
				answers={answers}
				onAnswers={setAnswers}
				onResult={(r) => (r.completed ? setDone(r) : setPage(r.page))}
			/>
		</section>
	);
}
