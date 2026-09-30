"use client";

import { Check, X } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { QuizCorrectness, QuizQuestion, QuizQuestionBody } from "@/types/quiz";
import { CORRECTNESS_STYLE } from "./quiz-format";

interface InputsProps {
	question: QuizQuestion;
	/** Current value of every field (rendered value or the user's edit). */
	values: Record<string, string>;
	onChange: (field: string, value: string) => void;
	/** Locked: a review, or a finished attempt. */
	readOnly: boolean;
}

const selectClass = "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70";

function Verdict({ correctness }: { correctness?: QuizCorrectness }) {
	if (!correctness) return null;
	const Icon = correctness === "incorrect" ? X : Check;
	const label = { correct: "Correct", partial: "Partially correct", incorrect: "Incorrect" }[correctness];
	return <Icon className={cn("size-4 shrink-0", correctness === "correct" ? "text-success" : correctness === "partial" ? "text-warning" : "text-danger")} aria-label={label} role="img" />;
}

function Choice({ body, values, onChange, readOnly }: { body: Extract<QuizQuestionBody, { kind: "choice" }> } & Omit<InputsProps, "question">) {
	const chosen = values[body.field];
	const hasChoice = !body.multiple && Boolean(chosen) && chosen !== "-1";
	return (
		<fieldset className="flex flex-col gap-2">
			{body.prompt && <legend className="mb-1 text-sm font-medium text-muted-foreground">{body.prompt}</legend>}
			{body.options.map((option) => {
				const checked = body.multiple ? values[option.field] === "1" : chosen === option.value;
				return (
					<div key={option.field + option.value} className="flex flex-col gap-1">
						<label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50", checked && "border-primary/50 bg-primary/5", option.correctness && CORRECTNESS_STYLE[option.correctness], readOnly && "cursor-default hover:bg-transparent")}>
							<input
								type={body.multiple ? "checkbox" : "radio"}
								name={option.field}
								value={option.value}
								checked={checked}
								disabled={readOnly}
								onChange={(e) => onChange(option.field, body.multiple ? (e.target.checked ? "1" : "0") : option.value)}
								className="mt-1 size-4 shrink-0 accent-primary"
							/>
							<RichContent html={option.html} className="min-w-0 flex-1 [&_p]:my-0" />
							<Verdict correctness={option.correctness} />
						</label>
						{option.feedbackHtml && <RichContent html={option.feedbackHtml} className="ml-10 text-xs text-muted-foreground" />}
					</div>
				);
			})}
			{hasChoice && !readOnly && (
				<Button type="button" variant="ghost" size="xs" className="w-fit" onClick={() => onChange(body.field, "-1")}>
					Clear my choice
				</Button>
			)}
		</fieldset>
	);
}

function TextAnswer({ body, values, onChange, readOnly }: { body: Extract<QuizQuestionBody, { kind: "text" }> } & Omit<InputsProps, "question">) {
	const { unit } = body;
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Input
				value={values[body.field] ?? ""}
				onChange={(e) => onChange(body.field, e.target.value)}
				readOnly={readOnly}
				inputMode={body.numeric ? "decimal" : undefined}
				autoComplete="off"
				aria-label="Answer"
				placeholder="Your answer"
				className={cn("max-w-64", body.correctness && CORRECTNESS_STYLE[body.correctness])}
			/>
			{unit?.options ? (
				<select aria-label="Unit" className={selectClass} value={values[unit.field] ?? ""} disabled={readOnly} onChange={(e) => onChange(unit.field, e.target.value)}>
					{unit.options.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			) : (
				unit && <Input aria-label="Unit" placeholder="Unit" className="max-w-24" value={values[unit.field] ?? ""} readOnly={readOnly} onChange={(e) => onChange(unit.field, e.target.value)} />
			)}
			<Verdict correctness={body.correctness} />
		</div>
	);
}

function Match({ body, values, onChange, readOnly }: { body: Extract<QuizQuestionBody, { kind: "match" }> } & Omit<InputsProps, "question">) {
	return (
		<ul className="flex flex-col gap-2">
			{body.rows.map((row) => (
				<li key={row.field} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
					<RichContent html={row.stemHtml} className="min-w-0 [&_p]:my-0" />
					<span className="flex items-center gap-2">
						<select
							aria-label="Match"
							className={cn(selectClass, row.correctness && CORRECTNESS_STYLE[row.correctness])}
							value={values[row.field] ?? "0"}
							disabled={readOnly}
							onChange={(e) => onChange(row.field, e.target.value)}
						>
							{row.options.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
						<Verdict correctness={row.correctness} />
					</span>
				</li>
			))}
		</ul>
	);
}

function Essay({ body, values, onChange, readOnly }: { body: Extract<QuizQuestionBody, { kind: "essay" }> } & Omit<InputsProps, "question">) {
	const { field } = body;
	return (
		<div className="flex flex-col gap-2">
			{readOnly || !field ? (
				<RichContent html={body.responseHtml ?? values[field ?? ""] ?? ""} className="rounded-lg border bg-muted/30 p-3" />
			) : body.format === 1 ? (
				<RichTextEditor initialHtml={values[field] ?? ""} onChange={(html) => onChange(field, html)} minRows={8} label="Your answer" />
			) : (
				<Textarea value={values[field] ?? ""} onChange={(e) => onChange(field, e.target.value)} rows={8} aria-label="Your answer" />
			)}
			{body.hasAttachments && !readOnly && <p className="text-xs text-muted-foreground">This question also accepts file attachments. Add them in Moodle.</p>}
		</div>
	);
}

/** The answer controls of one question, by type. Descriptions and unsupported types render nothing here. */
export function QuestionInputs({ question, values, onChange, readOnly }: InputsProps) {
	const { body } = question;
	const props = { values, onChange, readOnly };
	switch (body.kind) {
		case "choice":
			return <Choice body={body} {...props} />;
		case "text":
			return <TextAnswer body={body} {...props} />;
		case "match":
			return <Match body={body} {...props} />;
		case "essay":
			return <Essay body={body} {...props} />;
		default:
			return null;
	}
}
