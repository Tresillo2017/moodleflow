"use client";

import { useId } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Check, LogOut, Monitor, Moon, RotateCcw, RotateCw, Sun } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
	ACCENTS,
	CHOICES,
	DASHBOARD_SECTIONS,
	hueOf,
	type Accent,
	type ChoiceKey,
	type DashboardSection,
	type Preferences,
} from "@/lib/preferences";

const SECTIONS = [
	{ id: "appearance", label: "Appearance" },
	{ id: "layout", label: "Layout" },
	{ id: "dashboard", label: "Dashboard" },
	{ id: "datetime", label: "Date & time" },
	{ id: "account", label: "Account" },
	{ id: "about", label: "About" },
] as const;

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
	return (
		<section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-3">
			<div>
				<h2 id={`${id}-title`} className="text-2xl">
					{title}
				</h2>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			<div className="flex flex-col divide-y rounded-xl glass shadow-[var(--ring-inset)]">{children}</div>
		</section>
	);
}

/** One setting: label + hint on the left, control on the right (stacked on small screens). */
function Row({ label, hint, labelId, children }: { label: string; hint?: string; labelId?: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
			<div className="min-w-0">
				<p id={labelId} className="text-sm font-medium">
					{label}
				</p>
				{hint && <p className="text-xs text-muted-foreground text-pretty">{hint}</p>}
			</div>
			<div className="shrink-0">{children}</div>
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

function ChoiceRow({ name, label, hint, preview }: { name: ChoiceKey; label: string; hint?: string; preview?: boolean }) {
	const labelId = useId();
	return (
		<Row label={label} hint={hint} labelId={labelId}>
			<Segmented name={name} labelId={labelId} preview={preview} />
		</Row>
	);
}

const THEMES = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
] as const;

function ThemePreview({ mode }: { mode: "light" | "dark" | "system" }) {
	const pane = (dark: boolean) => (
		<div className={cn("flex flex-1 gap-1 p-1.5", dark ? "bg-neutral-950" : "bg-neutral-100")}>
			<div className={cn("w-1/4 rounded-sm", dark ? "bg-neutral-800" : "bg-white")} />
			<div className="flex flex-1 flex-col gap-1">
				<div className="h-1.5 w-2/3 rounded-full bg-primary" />
				<div className={cn("h-1.5 rounded-full", dark ? "bg-neutral-800" : "bg-white")} />
				<div className={cn("h-1.5 w-1/2 rounded-full", dark ? "bg-neutral-800" : "bg-white")} />
			</div>
		</div>
	);
	return (
		<div className="flex h-14 overflow-hidden rounded-md border">
			{mode === "system" ? (
				<>
					{pane(false)}
					{pane(true)}
				</>
			) : (
				pane(mode === "dark")
			)}
		</div>
	);
}

function ThemePicker() {
	const { theme, setTheme } = useTheme();
	const labelId = useId();
	return (
		<div className="flex flex-col gap-3 px-4 py-4">
			<div>
				<p id={labelId} className="text-sm font-medium">
					Theme
				</p>
				<p className="text-xs text-muted-foreground">System follows your device setting.</p>
			</div>
			<div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-3 gap-3">
				{THEMES.map(({ value, label, icon: Icon }) => (
					<label
						key={value}
						className={cn(
							"flex cursor-pointer flex-col gap-2 rounded-lg border p-2 transition-[border-color,box-shadow] hover:border-foreground/25 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
							theme === value && "border-primary ring-1 ring-primary hover:border-primary",
						)}
					>
						<input
							type="radio"
							name="theme"
							value={value}
							checked={theme === value}
							onChange={() => setTheme(value)}
							className="sr-only"
						/>
						<ThemePreview mode={value} />
						<span className="flex items-center gap-1.5 text-xs font-medium">
							<Icon className="size-3.5" aria-hidden="true" />
							{label}
						</span>
					</label>
				))}
			</div>
		</div>
	);
}

function AccentPicker() {
	const { prefs, setPrefs } = usePreferences();
	const labelId = useId();
	return (
		<Row label="Accent color" hint="Used for buttons, highlights and charts." labelId={labelId}>
			<div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
				{(Object.keys(ACCENTS) as Accent[]).map((accent) => {
					const checked = prefs.hue === null && prefs.accent === accent;
					return (
						<label
							key={accent}
							title={ACCENTS[accent].label}
							className="grid size-7 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110 active:scale-95 has-checked:ring-2 has-checked:ring-(--swatch) has-focus-visible:ring-2 has-focus-visible:ring-ring"
							style={{ background: `oklch(0.62 0.16 ${ACCENTS[accent].hue})`, "--swatch": `oklch(0.62 0.16 ${ACCENTS[accent].hue})` } as React.CSSProperties}
						>
							<input
								type="radio"
								name="accent"
								value={accent}
								checked={checked}
								onChange={() => setPrefs({ accent, hue: null })}
								className="sr-only"
							/>
							<span className="sr-only">{ACCENTS[accent].label}</span>
							{checked && <Check className="size-3.5 text-white motion-safe:animate-in motion-safe:zoom-in-50" aria-hidden="true" />}
						</label>
					);
				})}
			</div>
		</Row>
	);
}

function HueSlider() {
	const { prefs, setPref } = usePreferences();
	const labelId = useId();
	const hue = hueOf(prefs);
	return (
		<Row label="Custom hue" hint="Drag to pick any color. Choosing a swatch above resets it." labelId={labelId}>
			<div className="flex items-center gap-3">
				<input
					type="range"
					min={0}
					max={359}
					value={hue}
					aria-labelledby={labelId}
					onChange={(e) => setPref("hue", Number(e.target.value))}
					className="h-2 w-48 cursor-pointer appearance-none rounded-full accent-primary"
					style={{
						background:
							"linear-gradient(to right in oklch longer hue, oklch(0.7 0.15 0), oklch(0.7 0.15 359))",
					}}
				/>
				<span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{hue}°</span>
			</div>
		</Row>
	);
}

function DashboardToggles() {
	const { prefs, setPref } = usePreferences();
	return (
		<>
			{(Object.keys(DASHBOARD_SECTIONS) as DashboardSection[]).map((key) => (
				<label key={key} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
					<span className="text-sm font-medium">{DASHBOARD_SECTIONS[key]}</span>
					<Switch
						checked={prefs.dashboard[key]}
						onCheckedChange={(checked) => setPref("dashboard", { ...prefs.dashboard, [key]: checked })}
					/>
				</label>
			))}
		</>
	);
}

function AccountSection() {
	const { connection, disconnect, refresh } = useMoodleConnection();
	const { reset } = usePreferences();
	return (
		<Section id="account" title="Account" description="MoodleFlow keeps your token and preferences only in this browser.">
			<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{connection?.siteName ?? "Moodle site"}</p>
					<p className="truncate text-xs text-muted-foreground">
						{connection?.userFullName ? `${connection.userFullName} · ` : ""}
						{connection?.siteUrl}
					</p>
				</div>
				<Badge variant="outline" className="border-success/30 bg-success/10 text-success">
					{connection?.mock ? "Demo mode" : "Connected"}
				</Badge>
			</div>
			<Row label="Refresh data" hint="Reload courses, grades and events from Moodle.">
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						refresh();
						toast.success("Refreshing data from Moodle");
					}}
				>
					<RotateCw aria-hidden="true" />
					Refresh
				</Button>
			</Row>
			<Row label="Reset preferences" hint="Restore the default look and layout.">
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						reset();
						toast.success("Preferences reset");
					}}
				>
					<RotateCcw aria-hidden="true" />
					Reset
				</Button>
			</Row>
			<Row label="Sign out" hint="Removes the saved token from this browser.">
				<Button
					variant="destructive"
					size="sm"
					onClick={() => {
						disconnect();
						toast.success("Disconnected from Moodle");
					}}
				>
					<LogOut aria-hidden="true" />
					Sign out
				</Button>
			</Row>
		</Section>
	);
}

export default function SettingsPage() {
	const { resolvedTheme } = useTheme();
	const { prefs } = usePreferences();

	return (
		<div className="flex flex-col gap-8">
			<PageHeader title="Settings" description="Changes apply instantly and are saved to this browser." />

			<div className="grid gap-8 lg:grid-cols-[10rem_minmax(0,1fr)]">
				<nav aria-label="Settings sections" className="hidden lg:block">
					<ul className="sticky top-20 flex flex-col gap-0.5 text-sm">
						{SECTIONS.map((s) => (
							<li key={s.id}>
								<a
									href={`#${s.id}`}
									className="block rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								>
									{s.label}
								</a>
							</li>
						))}
					</ul>
				</nav>

				<div className="flex max-w-3xl flex-col gap-10">
					<Section id="appearance" title="Appearance" description="Colors, shapes and type.">
						<ThemePicker />
						<ChoiceRow
							name={resolvedTheme === "dark" ? "darkTheme" : "lightTheme"}
							label="Color theme"
							hint="Named themes come from bleh. Each mode keeps its own choice."
						/>
						<AccentPicker />
						<HueSlider />
						<ChoiceRow name="vibrance" label="Vibrance" hint="How saturated surfaces and accents are." />
						<ChoiceRow name="glass" label="Glass blur" hint="Frosted, translucent panels. Off makes them solid." />
						<ChoiceRow name="season" label="Season" hint="Tints the theme for a holiday. Automatic follows bleh's calendar." />
						<ChoiceRow name="overlays" label="Seasonal overlays" hint="Icicles and other decoration at the top of cards." />
						<ChoiceRow name="particles" label="Seasonal particles" hint="Falling snow while a season with snow is active." />
						<ChoiceRow name="radius" label="Corner radius" />
						<ChoiceRow name="font" label="Font" preview />
						<ChoiceRow name="weight" label="Font weight" />
						<ChoiceRow name="scale" label="Text size" hint="Scales the whole interface." />
						<ChoiceRow name="motion" label="Motion" hint="Reduced turns off page and list animations." />
					</Section>

					<Section id="layout" title="Layout" description="How the app frame is arranged.">
						<ChoiceRow name="sidebar" label="Sidebar style" hint="Collapse it any time with ⌘B." />
						<ChoiceRow name="width" label="Content width" hint="Wide and Full use more of large screens." />
					</Section>

					<Section id="dashboard" title="Dashboard" description="Choose which sections appear on your dashboard.">
						<DashboardToggles />
					</Section>

					<Section id="datetime" title="Date & time" description="How dates and times are shown.">
						<ChoiceRow name="weekStart" label="Week starts on" />
						<ChoiceRow name="clock" label="Clock" hint="Auto follows your browser's locale." />
					</Section>

					<AccountSection />

					<Section id="about" title="About" description="Which version you're running.">
						<Row label={`MoodleFlow v${process.env.NEXT_PUBLIC_APP_VERSION}`} hint="See what changed in each release.">
							<Button variant="outline" size="sm" nativeButton={false} render={<Link href="/changelog" />}>
								What&apos;s new
							</Button>
						</Row>
					</Section>
				</div>
			</div>
		</div>
	);
}
