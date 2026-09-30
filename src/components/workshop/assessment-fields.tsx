"use client";

import { RichContent } from "@/components/content/rich-content";
import { Textarea } from "@/components/ui/textarea";
import type { AssessmentDimension, AssessmentForm, AssessmentValues } from "@/types/workshop";

type DimensionAnswer = AssessmentValues["dimensions"][number];

const SELECT_CLASS = "h-8 w-fit rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Human label of the chosen grade, for the read-only view. */
function gradeLabel(form: AssessmentForm, dim: AssessmentDimension, answer: DimensionAnswer | undefined): string | null {
	if (form.strategy === "rubric") return dim.levels?.find((l) => l.id === answer?.chosenLevel)?.definition ?? null;
	if (answer?.grade === undefined || form.strategy === "comments") return null;
	if (form.strategy === "numerrors") return dim.labels?.[answer.grade === 1 ? 1 : 0] ?? String(answer.grade);
	return dim.scale ? (dim.scale[answer.grade - 1] ?? String(answer.grade)) : `${answer.grade} / ${dim.maxGrade}`;
}

function GradeInput({ form, dim, answer, onChange }: { form: AssessmentForm; dim: AssessmentDimension; answer: DimensionAnswer | undefined; onChange: (next: DimensionAnswer) => void }) {
	const name = `dimension-${dim.index}`;
	if (form.strategy === "rubric") {
		return (
			<div role="radiogroup" aria-label="Level" className="flex flex-col gap-1.5">
				{dim.levels?.map((level) => (
					<label key={level.id} className="flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5">
						<input type="radio" name={name} className="mt-1" checked={answer?.chosenLevel === level.id} onChange={() => onChange({ ...answer, chosenLevel: level.id })} />
						<span className="flex-1">{level.definition}</span>
						<span className="text-xs text-muted-foreground tabular-nums">{level.grade} pts</span>
					</label>
				))}
			</div>
		);
	}
	if (form.strategy === "numerrors") {
		return (
			<div role="radiogroup" aria-label="Answer" className="flex flex-wrap gap-2">
				{([1, 0] as const).map((value) => (
					<label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/5">
						<input type="radio" name={name} checked={answer?.grade === value} onChange={() => onChange({ ...answer, grade: value })} />
						{dim.labels?.[value]}
					</label>
				))}
			</div>
		);
	}
	if (form.strategy === "comments") return null;
	const options = dim.scale ? dim.scale.map((label, i) => ({ value: i + 1, label })) : Array.from({ length: (dim.maxGrade ?? 0) + 1 }, (_, i) => ({ value: i, label: `${i} / ${dim.maxGrade}` }));
	return (
		<select className={SELECT_CLASS} aria-label="Grade" value={answer?.grade ?? ""} onChange={(e) => onChange({ ...answer, grade: e.target.value === "" ? undefined : Number(e.target.value) })}>
			<option value="">Choose a grade…</option>
			{options.map((o) => (
				<option key={o.value} value={o.value}>{o.label}</option>
			))}
		</select>
	);
}

interface AssessmentFieldsProps {
	form: AssessmentForm;
	values: AssessmentValues;
	onChange: (next: AssessmentValues) => void;
}

/** The dimensions of an assessment form as inputs; comments are plain text here (converted at save). */
export function AssessmentFields({ form, values, onChange }: AssessmentFieldsProps) {
	const update = (index: number, answer: DimensionAnswer) => onChange({ ...values, dimensions: { ...values.dimensions, [index]: answer } });
	return (
		<ol className="flex flex-col gap-4">
			{form.dimensions.map((dim, i) => {
				const answer = values.dimensions[dim.index];
				return (
					<li key={dim.index} className="flex flex-col gap-2 rounded-xl border p-3">
						<div className="flex items-start gap-2">
							<span className="mt-0.5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
							<RichContent html={dim.description} className="flex-1" />
						</div>
						<GradeInput form={form} dim={dim} answer={answer} onChange={(next) => update(dim.index, next)} />
						<Textarea
							value={answer?.comment ?? ""}
							onChange={(e) => update(dim.index, { ...answer, comment: e.target.value })}
							placeholder="Comment (optional)"
							aria-label={`Comment on criterion ${i + 1}`}
							rows={2}
						/>
					</li>
				);
			})}
		</ol>
	);
}

/** Read-only view of a filled-in form: each criterion with the grade given and the comment (Moodle HTML). */
export function AssessmentSummary({ form, values }: { form: AssessmentForm; values: AssessmentValues }) {
	return (
		<ol className="flex flex-col gap-3">
			{form.dimensions.map((dim, i) => {
				const answer = values.dimensions[dim.index];
				const grade = gradeLabel(form, dim, answer);
				return (
					<li key={dim.index} className="flex flex-col gap-1 rounded-xl border p-3">
						<div className="flex items-start gap-2">
							<span className="mt-0.5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
							<RichContent html={dim.description} className="flex-1" />
						</div>
						{grade && <p className="text-sm font-medium">{grade}</p>}
						{answer?.comment && <RichContent html={answer.comment} className="text-muted-foreground" />}
					</li>
				);
			})}
		</ol>
	);
}
