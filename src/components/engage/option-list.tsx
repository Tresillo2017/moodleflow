import { cn } from "@/lib/utils";

export interface OptionItem {
	value: string;
	label: React.ReactNode;
	disabled?: boolean;
}

/** Radio or checkbox group shared by the choice, feedback and survey pages. `value` holds the selected option values. */
export function OptionList({
	name,
	label,
	options,
	multiple,
	value,
	onChange,
	disabled,
	horizontal,
	invalid,
}: {
	name: string;
	/** Accessible name for the group. */
	label: string;
	options: OptionItem[];
	multiple?: boolean;
	value: string[];
	onChange: (value: string[]) => void;
	disabled?: boolean;
	horizontal?: boolean;
	invalid?: boolean;
}) {
	const toggle = (v: string, on: boolean) => onChange(multiple ? (on ? [...value, v] : value.filter((x) => x !== v)) : [v]);
	return (
		<div role={multiple ? "group" : "radiogroup"} aria-label={label} aria-invalid={invalid || undefined} className={cn("flex gap-2", horizontal ? "flex-wrap" : "flex-col")}>
			{options.map((o) => (
				<label
					key={o.value}
					className={cn(
						"flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
						invalid && "border-destructive/50",
						(disabled || o.disabled) && "cursor-not-allowed opacity-60 hover:bg-transparent",
					)}
				>
					<input
						type={multiple ? "checkbox" : "radio"}
						name={name}
						value={o.value}
						checked={value.includes(o.value)}
						disabled={disabled || o.disabled}
						onChange={(e) => toggle(o.value, e.target.checked)}
						className="size-4 shrink-0 accent-primary"
					/>
					<span className="min-w-0 flex-1">{o.label}</span>
				</label>
			))}
		</div>
	);
}
