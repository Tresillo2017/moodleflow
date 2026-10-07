"use client";

import { createContext, useContext, useId } from "react";
import { motion } from "motion/react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";
import { CHOICES, type ChoiceKey, type Preferences } from "@/lib/preferences";

/** The sidebar's search text; empty when not searching. Rows and blocks that don't match hide themselves. */
export const SettingsSearchContext = createContext("");

function useMatches(...text: (string | undefined)[]): boolean {
	const query = useContext(SettingsSearchContext).trim().toLowerCase();
	return !query || text.some((t) => t?.toLowerCase().includes(query));
}

export function Section({
	id,
	title,
	icon: Icon,
	children,
}: {
	id: string;
	title: string;
	icon: React.ElementType;
	children: React.ReactNode;
}) {
	const searching = useContext(SettingsSearchContext).trim() !== "";
	return (
		<section
			id={id}
			aria-labelledby={`${id}-title`}
			className={cn("flex scroll-mt-24 flex-col gap-3", searching && "hidden has-[[data-row]]:flex")}
		>
			<h2 id={`${id}-title`} className="flex items-center gap-2 pt-2 font-sans text-base font-semibold not-italic">
				<Icon className="size-4 text-(--sh-accent-2)" aria-hidden="true" />
				{title}
			</h2>
			{children}
		</section>
	);
}

/** A bordered group of rows (one bleh "card"). */
export function Group({ children }: { children: React.ReactNode }) {
	return <div className="st-group flex flex-col divide-y">{children}</div>;
}

/** A custom setting (not a plain label + control row) that still takes part in search. */
export function Block({ keywords, children, className }: { keywords: string; children: React.ReactNode; className?: string }) {
	if (!useMatches(keywords)) return null;
	return (
		<div data-row="" className={className}>
			{children}
		</div>
	);
}

/** One setting: label + hint on the left, control on the right (stacked on small screens). */
export function Row({
	label,
	hint,
	labelId,
	children,
}: {
	label: string;
	hint?: string;
	labelId?: string;
	children: React.ReactNode;
}) {
	if (!useMatches(label, hint)) return null;
	return (
		<div data-row="" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
			<div className="min-w-48 flex-1 basis-56">
				<p id={labelId} className="text-sm font-medium">
					{label}
				</p>
				{hint && <p className="text-xs text-muted-foreground text-pretty">{hint}</p>}
			</div>
			<div className="max-w-full">{children}</div>
		</div>
	);
}

/** Segmented control built on native radios, so arrow keys and form semantics come for free. */
function Segmented<K extends ChoiceKey>({ name, labelId, preview }: { name: K; labelId: string; preview?: boolean }) {
	const { prefs, setPref } = usePreferences();
	return (
		<div role="radiogroup" aria-labelledby={labelId} className="inline-flex flex-wrap rounded-lg bg-muted p-[3px]">
			{Object.entries(CHOICES[name]).map(([value, text]) => {
				const checked = prefs[name] === value;
				return (
					<label
						key={value}
						data-font={preview ? value : undefined}
						className={cn(
							"relative cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
							preview && "font-sans",
							checked ? "text-foreground" : "text-muted-foreground hover:text-foreground",
						)}
					>
						<input
							type="radio"
							name={name}
							value={value}
							checked={checked}
							onChange={() => setPref(name, value as Preferences[K])}
							className="sr-only"
						/>
						{checked && (
							<motion.span
								layoutId={`segmented-${name}`}
								className="absolute inset-0 rounded-md bg-background shadow-sm dark:bg-input/40"
								transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
							/>
						)}
						<span className="relative">{text}</span>
					</label>
				);
			})}
		</div>
	);
}

export function ChoiceRow({ name, label, hint, preview }: { name: ChoiceKey; label: string; hint?: string; preview?: boolean }) {
	const labelId = useId();
	return (
		<Row label={label} hint={hint} labelId={labelId}>
			<Segmented name={name} labelId={labelId} preview={preview} />
		</Row>
	);
}

/** A range input with the current value on the right; `fill` paints the track up to the thumb. */
export function SliderRow({
	label,
	hint,
	value,
	min,
	max,
	step,
	onChange,
	format = String,
}: {
	label: string;
	hint: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
	format?: (value: number) => string;
}) {
	const labelId = useId();
	return (
		<Row label={label} hint={hint} labelId={labelId}>
			<div className="flex w-72 max-w-full items-center gap-3">
				<input
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					aria-labelledby={labelId}
					onChange={(e) => onChange(Number(e.target.value))}
					className="st-range"
					style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
				/>
				<span className="w-10 text-right text-xs text-(--sh-accent) tabular-nums">{format(value)}</span>
			</div>
		</Row>
	);
}
