"use client";

import { ExternalLink, Flag } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuizFeedbackBlock, QuizQuestion } from "@/types/quiz";
import { QuestionInputs } from "./question-inputs";
import { STATE_LABEL } from "./quiz-format";

const FEEDBACK_TITLE: Record<QuizFeedbackBlock["kind"], string> = {
	specific: "Feedback",
	general: "General feedback",
	rightanswer: "Correct answer",
	teacher: "Comment from your teacher",
};

const STATE_BADGE: Record<string, string> = {
	correct: "bg-success/10 text-success",
	partial: "bg-warning/10 text-warning",
	incorrect: "bg-danger/10 text-danger",
};

interface QuestionCardProps {
	question: QuizQuestion;
	values: Record<string, string>;
	onChange: (field: string, value: string) => void;
	/** Attempt mode: called to flag or unflag. Omit for a review. */
	onToggleFlag?: (question: QuizQuestion) => void;
	flagged?: boolean;
	/** Reviewing a finished attempt: show the grading state and feedback. */
	review?: boolean;
	/** "Open in Moodle" target for question types we can't render. */
	fallbackUrl?: string;
}

/** One question: number, marks, flag, stem, answer controls, and (in review) feedback. */
export function QuestionCard({ question: q, values, onChange, onToggleFlag, flagged = q.flagged, review = false, fallbackUrl }: QuestionCardProps) {
	const unsupported = q.body.kind === "unsupported";
	const stateLabel = STATE_LABEL[q.state];
	return (
		<section id={`question-${q.slot}`} className="scroll-mt-20 flex flex-col gap-4 rounded-xl border bg-card p-4" aria-label={q.number ? `Question ${q.number}` : "Information"}>
			{q.body.kind !== "description" && (
				<header className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-sm font-semibold">Question {q.number}</h2>
						{review && stateLabel && <Badge variant="secondary" className={STATE_BADGE[q.state]}>{stateLabel}</Badge>}
						{q.maxMark && (
							<span className="text-xs text-muted-foreground tabular-nums">
								{review && q.mark !== undefined ? `Mark ${q.mark} out of ${q.maxMark}` : `Marked out of ${q.maxMark}`}
							</span>
						)}
					</div>
					{onToggleFlag && (
						<Button type="button" variant="ghost" size="sm" aria-pressed={flagged} disabled={!q.flag} onClick={() => onToggleFlag(q)} className={cn(flagged && "text-warning")}>
							<Flag className={cn(flagged && "fill-current")} aria-hidden="true" />
							{flagged ? "Flagged" : "Flag question"}
						</Button>
					)}
					{review && flagged && <Flag className="size-4 fill-current text-warning" aria-label="Flagged" role="img" />}
				</header>
			)}
			{q.textHtml && <RichContent html={q.textHtml} />}
			{unsupported && (
				<Alert>
					<AlertTitle>This question type can't be answered here</AlertTitle>
					<AlertDescription>
						{review ? "Moodle's review shows it best." : "You can answer it in Moodle, then come back."}
						{fallbackUrl && (
							<a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary underline">
								Open in Moodle
								<ExternalLink className="size-3" aria-hidden="true" />
							</a>
						)}
					</AlertDescription>
				</Alert>
			)}
			<QuestionInputs question={q} values={values} onChange={onChange} readOnly={review || q.readOnly} />
			{review &&
				q.feedback.map((block, i) => (
					<div key={block.kind + i} className="rounded-lg border bg-muted/30 p-3">
						<p className="mb-1 text-xs font-medium text-muted-foreground">{FEEDBACK_TITLE[block.kind]}</p>
						<RichContent html={block.html} />
					</div>
				))}
		</section>
	);
}
