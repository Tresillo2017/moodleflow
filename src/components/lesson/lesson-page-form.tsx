"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichContent } from "@/components/content/rich-content";
import { isLessonInputComplete } from "@/lib/moodle/normalize-lesson";
import { stripHtml } from "@/lib/moodle/normalize-messaging";
import type { LessonInput, LessonPage } from "@/types/lesson";

const CHOICE = "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary";

/** A lesson page: its content plus the controls for its type. Remount (via `key`) for a fresh form. */
export function LessonPageForm({ page, busy, onSubmit }: { page: LessonPage; busy: boolean; onSubmit: (input: LessonInput) => void }) {
	const [input, setInput] = useState<LessonInput>({});
	const patch = (p: Partial<LessonInput>) => setInput((i) => ({ ...i, ...p }));
	const spinner = busy && <Loader2 className="animate-spin" aria-hidden="true" />;

	if (page.kind === "content") {
		// each button is its own submit: Moodle jumps wherever that answer points
		const buttons = page.answers.length ? page.answers : [{ id: 0, text: "Continue", jumpTo: -1 }];
		return (
			<div className="flex flex-col gap-4">
				<RichContent html={page.contents} className="rounded-xl border bg-card p-4" />
				<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
					{buttons.map((a) => (
						<Button key={a.id} variant={buttons.length === 1 ? "default" : "outline"} disabled={busy} onClick={() => onSubmit({ jumpTo: a.jumpTo })}>
							{spinner}
							{stripHtml(a.text) || "Continue"}
						</Button>
					))}
				</div>
			</div>
		);
	}

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				if (isLessonInputComplete(page, input)) onSubmit(input);
			}}
		>
			<RichContent html={page.contents} className="rounded-xl border bg-card p-4" />
			<fieldset className="flex flex-col gap-2" disabled={busy}>
				<legend className="sr-only">Your answer</legend>
				{(page.kind === "multichoice" || page.kind === "truefalse") &&
					page.answers.map((a) => (
						<label key={a.id} className={CHOICE}>
							{page.multiple ? (
								<input
									type="checkbox"
									className="mt-1 accent-primary"
									checked={input.choices?.includes(a.id) ?? false}
									onChange={(e) => patch({ choices: e.target.checked ? [...(input.choices ?? []), a.id] : (input.choices ?? []).filter((id) => id !== a.id) })}
								/>
							) : (
								<input type="radio" name="choice" className="mt-1 accent-primary" checked={input.choice === a.id} onChange={() => patch({ choice: a.id })} />
							)}
							<RichContent html={a.text} className="min-w-0 flex-1" />
						</label>
					))}
				{(page.kind === "shortanswer" || page.kind === "numerical") && (
					<Input
						aria-label="Your answer"
						inputMode={page.kind === "numerical" ? "decimal" : "text"}
						autoComplete="off"
						value={input.text ?? ""}
						onChange={(e) => patch({ text: e.target.value })}
					/>
				)}
				{page.kind === "essay" && <Textarea aria-label="Your answer" rows={8} value={input.text ?? ""} onChange={(e) => patch({ text: e.target.value })} />}
				{page.kind === "matching" &&
					page.pairs.map((pair) => (
						<div key={pair.id} className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
							<RichContent html={pair.prompt} className="min-w-0 flex-1" />
							<select
								aria-label="Match"
								className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
								value={input.matches?.[pair.id] ?? ""}
								onChange={(e) => patch({ matches: { ...input.matches, [pair.id]: e.target.value } })}
							>
								<option value="">Choose…</option>
								{pair.options.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</div>
					))}
			</fieldset>
			<div>
				<Button type="submit" disabled={busy || !isLessonInputComplete(page, input)}>
					{spinner}
					Submit
				</Button>
			</div>
		</form>
	);
}
