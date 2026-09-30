"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { RichContent } from "@/components/content/rich-content";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, ListSkeleton } from "@/components/ui/state";
import { OptionList } from "@/components/engage/option-list";
import { surveyAnswerList, surveyKey, unansweredSurveyKeys } from "@/lib/moodle/normalize-engage";
import { toast } from "@/lib/toast";
import type { Survey, SurveyAnswers, SurveyQuestion } from "@/types/engage";

function Scale({ q, preferred, label, answers, invalid, onPick }: { q: SurveyQuestion; preferred: boolean; label?: string; answers: SurveyAnswers; invalid: boolean; onPick: (key: string, value: string) => void }) {
	const key = surveyKey(q.id, preferred);
	return (
		<div className="flex flex-col gap-1.5">
			{label && <p className="text-xs text-muted-foreground">{label}</p>}
			<OptionList horizontal name={key} label={label ? `${q.text} (${label})` : q.text} invalid={invalid} value={answers[key] ? [answers[key]] : []} onChange={(v) => onPick(key, v[0])} options={q.options.map((o, i) => ({ value: String(i + 1), label: o }))} />
		</div>
	);
}

function Question({ q, answers, missing, onPick }: { q: SurveyQuestion; answers: SurveyAnswers; missing: Set<string>; onPick: (key: string, value: string) => void }) {
	if (q.kind === "header") {
		return (
			<div className="flex flex-col gap-1 border-t pt-4 first:border-t-0 first:pt-0">
				<h3 className="text-base font-semibold">{q.text}</h3>
				{q.intro && <RichContent html={q.intro} />}
			</div>
		);
	}
	const both = q.actual && q.preferred;
	return (
		<div className={q.isSub ? "flex flex-col gap-3 pl-3" : "flex flex-col gap-3"}>
			<p className="text-sm font-medium">{q.text}</p>
			{q.kind === "text" ? (
				<Textarea rows={3} aria-label={q.text} value={answers[surveyKey(q.id)] ?? ""} onChange={(e) => onPick(surveyKey(q.id), e.target.value)} />
			) : (
				<>
					{q.actual && <Scale q={q} preferred={false} label={both ? "What I found" : undefined} answers={answers} invalid={missing.has(surveyKey(q.id))} onPick={onPick} />}
					{q.preferred && <Scale q={q} preferred label={both ? "What I prefer" : undefined} answers={answers} invalid={missing.has(surveyKey(q.id, true))} onPick={onPick} />}
				</>
			)}
		</div>
	);
}

/** Answers a survey's questions (scales, with "actual" and "preferred" rows where the survey has both) and submits them once. */
export function SurveyView({ survey }: { survey: Survey }) {
	const { client, refresh } = useMoodleConnection();
	const query = useMoodleQuery(client && !survey.done ? () => client.getSurveyQuestions(survey.id) : null, [client, survey.id, survey.done]);
	const [answers, setAnswers] = useState<SurveyAnswers>({});
	const [missing, setMissing] = useState<Set<string>>(new Set());
	const [busy, setBusy] = useState(false);
	const [submitted, setSubmitted] = useState(false);

	if (survey.done || submitted) {
		return (
			<div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-8 text-center">
				<CheckCircle2 className="size-8 text-success" aria-hidden="true" />
				<p className="text-sm font-medium">{submitted ? "Thanks, your answers were submitted" : "You've already completed this survey"}</p>
			</div>
		);
	}
	if (query.loading) return <ListSkeleton rows={4} />;
	if (query.error) return <ErrorState error={query.error} onRetry={refresh} />;
	const questions = query.data;
	if (!questions || !client) return null;

	const pick = (key: string, value: string) => {
		setAnswers((a) => ({ ...a, [key]: value }));
		setMissing((m) => (m.has(key) ? new Set([...m].filter((k) => k !== key)) : m));
	};

	async function submit() {
		if (!client || !questions) return;
		const unanswered = unansweredSurveyKeys(questions, answers);
		setMissing(new Set(unanswered));
		if (unanswered.length) return toast.error("Answer every scale question before submitting.");
		setBusy(true);
		try {
			await client.submitSurveyAnswers(survey.id, surveyAnswerList(questions, answers));
			setSubmitted(true);
		} catch (e) {
			toast.error(e instanceof Error && e.message ? e.message : "Couldn't submit your answers. Try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<form
			className="flex flex-col gap-6 rounded-xl border bg-card p-4 md:p-6"
			onSubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
		>
			{questions.map((q) => (
				<Question key={q.id} q={q} answers={answers} missing={missing} onPick={pick} />
			))}
			{questions.length === 0 && <p className="text-sm text-muted-foreground">This survey has no questions.</p>}
			<div className="border-t pt-4">
				<Button type="submit" disabled={busy || questions.length === 0}>
					{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
					Submit answers
				</Button>
			</div>
		</form>
	);
}
