import { AlertTriangle, Info } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OptionList } from "@/components/engage/option-list";
import { cn } from "@/lib/utils";
import type { FeedbackItem } from "@/types/engage";

const NOT_SELECTED = "";

function Choices({ item, answer, onChange, invalid }: { item: FeedbackItem; answer: string | string[]; onChange: (v: string | string[]) => void; invalid: boolean }) {
	const choices = item.choices ?? [];
	if (item.style === "dropdown") {
		return (
			<select
				value={answer as string}
				onChange={(e) => onChange(e.target.value)}
				aria-label={item.name}
				aria-invalid={invalid || undefined}
				className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 md:max-w-sm"
			>
				<option value={NOT_SELECTED}>Choose...</option>
				{choices.map((c) => (
					<option key={c.value} value={String(c.value)}>
						{c.label}
					</option>
				))}
			</select>
		);
	}
	const multiple = item.style === "check";
	const options = choices.map((c) => ({ value: String(c.value), label: c.label }));
	// radios can be cleared unless the item is required or hides the "not selected" option
	if (!multiple && !item.required && !item.hideNoSelect) options.push({ value: NOT_SELECTED, label: "Not selected" });
	const value = multiple ? (answer as string[]) : [answer as string];
	return <OptionList name={`item-${item.id}`} label={item.name} multiple={multiple} value={value} invalid={invalid} options={options} onChange={(v) => onChange(multiple ? v : (v[0] ?? NOT_SELECTED))} />;
}

function Control({ item, answer, onChange, invalid }: { item: FeedbackItem; answer: string | string[]; onChange: (v: string | string[]) => void; invalid: boolean }) {
	const text = typeof answer === "string" ? answer : "";
	switch (item.type) {
		case "textfield":
			return <Input value={text} maxLength={item.maxLength} onChange={(e) => onChange(e.target.value)} aria-label={item.name} aria-invalid={invalid || undefined} />;
		case "textarea":
			return <Textarea value={text} rows={4} onChange={(e) => onChange(e.target.value)} aria-label={item.name} aria-invalid={invalid || undefined} />;
		case "numeric":
			return (
				<div className="flex flex-col gap-1">
					<Input type="number" inputMode="decimal" step="any" min={item.min} max={item.max} value={text} onChange={(e) => onChange(e.target.value)} aria-label={item.name} aria-invalid={invalid || undefined} className="md:max-w-40" />
					{(item.min !== undefined || item.max !== undefined) && (
						<p className="text-xs text-muted-foreground">
							{item.min !== undefined && item.max !== undefined ? `Between ${item.min} and ${item.max}` : item.min !== undefined ? `At least ${item.min}` : `At most ${item.max}`}
						</p>
					)}
				</div>
			);
		case "multichoice":
			return <Choices item={item} answer={answer} onChange={onChange} invalid={invalid} />;
		default:
			return null;
	}
}

/** One feedback question, rendered by item type. Info, captcha and unknown types get read-only fallbacks. */
export function FeedbackItemField({ item, answer, onChange, invalid }: { item: FeedbackItem; answer: string | string[]; onChange: (v: string | string[]) => void; invalid: boolean }) {
	if (item.type === "label") return item.html ? <RichContent html={item.html} /> : null;
	if (item.type === "info") {
		return (
			<p className="flex items-center gap-2 text-sm text-muted-foreground">
				<Info className="size-4 shrink-0" aria-hidden="true" />
				{item.name}: {item.infoKind === 1 ? new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "filled in automatically by Moodle"}
			</p>
		);
	}
	if (item.type === "captcha" || item.type === "unsupported") {
		return (
			<div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
				<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				<p>
					{item.type === "captcha" ? "This feedback has a CAPTCHA question, which can't be answered here." : `"${item.name || item.rawType}" is a question type that isn't supported here.`} If Moodle rejects your answers, complete it in Moodle instead.
				</p>
			</div>
		);
	}
	return (
		<div className={cn("flex flex-col gap-2", invalid && "rounded-lg ring-1 ring-destructive/40 ring-offset-8 ring-offset-background")}>
			<p className="text-sm font-medium">
				{item.name}
				{item.required && (
					<span className="text-destructive" aria-label="required">
						{" "}
						*
					</span>
				)}
			</p>
			<Control item={item} answer={answer} onChange={onChange} invalid={invalid} />
			{invalid && (
				<p role="alert" className="text-xs text-destructive">
					{item.type === "numeric" ? "Enter a number within the allowed range." : "This question needs an answer."}
				</p>
			)}
		</div>
	);
}
