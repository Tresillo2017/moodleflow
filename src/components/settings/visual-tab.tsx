"use client";

import { useId } from "react";
import { useTheme } from "next-themes";
import { Check, Moon, Palette, Paintbrush, Sparkles, Sun } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Switch } from "@/components/ui/switch";
import { ACCENTS, CHOICES, NOISE_MAX, VIBRANCY_MAX, hueOf, type Accent, type Preferences } from "@/lib/preferences";
import { Block, ChoiceRow, Group, Row, Section, SliderRow } from "./settings-ui";

type Mode = "light" | "dark";

interface ThemeCard {
	value: string;
	bg: string;
	fg: string;
	isNew?: boolean;
}

/** The colours of each theme's preview tile (the real palettes live in styles/bleh/theme.css). */
const THEMES: Record<Mode, { title: string; hint: string; icon: React.ElementType; key: "lightTheme" | "darkTheme"; cards: ThemeCard[] }> = {
	light: {
		title: "Bright",
		hint: "Perfect for daylight",
		icon: Sun,
		key: "lightTheme",
		cards: [
			{ value: "light", bg: "#f7f4f2", fg: "#2d2926" },
			{ value: "ink", bg: "#f3dcd8", fg: "#4a2f2b" },
			{ value: "rose_pine_dawn", bg: "#faf4ed", fg: "#575279", isNew: true },
		],
	},
	dark: {
		title: "Moody",
		hint: "Get cosy under the moonlight",
		icon: Moon,
		key: "darkTheme",
		cards: [
			{ value: "dark", bg: "#2a2422", fg: "#e9e2de" },
			{ value: "darker", bg: "#171413", fg: "#e9e2de" },
			{ value: "oled", bg: "#000000", fg: "#e9e2de" },
			{ value: "rose_pine", bg: "#191724", fg: "#e0def4", isNew: true },
			{ value: "kanagawa_dragon", bg: "#181616", fg: "#c5c9c5", isNew: true },
		],
	},
};

function ThemeGroup({ mode, selected }: { mode: Mode; selected: boolean }) {
	const { prefs, setPref } = usePreferences();
	const { theme, setTheme } = useTheme();
	const { title, hint, icon: Icon, key, cards } = THEMES[mode];
	const current = prefs[key];
	const labels = CHOICES[key] as Record<string, string>;
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
			<div className="flex min-w-48 flex-1 basis-56 items-center gap-3">
				<Icon className="size-4 shrink-0 text-(--sh-accent-2)" aria-hidden="true" />
				<div>
					<p className="text-sm font-medium">{title}</p>
					<p className="text-xs text-muted-foreground">{hint}</p>
				</div>
			</div>
			<div role="radiogroup" aria-label={`${title} themes`} className="flex flex-wrap justify-end gap-2.5 pt-1.5">
				{cards.map((card) => (
					<label key={card.value} className="st-theme">
						<input
							type="radio"
							name={`theme-${mode}`}
							value={card.value}
							checked={selected && current === card.value}
							onChange={() => {
								setPref(key, card.value as Preferences[typeof key]);
								if (theme !== "system") setTheme(mode);
							}}
							className="sr-only"
						/>
						{card.isNew && <span className="st-theme-new">New</span>}
						<span className="st-theme-swatch" style={{ "--tbg": card.bg, "--tfg": card.fg } as React.CSSProperties}>
							Aa
							<i />
						</span>
						{labels[card.value]}
					</label>
				))}
			</div>
		</div>
	);
}

function Themes() {
	const { theme, resolvedTheme } = useTheme();
	const { setTheme } = useTheme();
	const matchSystem = theme === "system";
	const checkId = useId();
	const mode: Mode = resolvedTheme === "dark" ? "dark" : "light";
	return (
		<Group>
			<Block keywords="themes bright light moody dark ink void oled rosé pine kanagawa dragon">
				<div className="flex flex-col divide-y">
					<ThemeGroup mode="light" selected={matchSystem || mode === "light"} />
					<ThemeGroup mode="dark" selected={matchSystem || mode === "dark"} />
				</div>
			</Block>
			<Block keywords="match system settings follow device">
				<label htmlFor={checkId} className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm font-medium">
					<input
						id={checkId}
						type="checkbox"
						checked={matchSystem}
						onChange={(e) => setTheme(e.target.checked ? "system" : mode)}
						className="size-4 cursor-pointer accent-(--sh-accent)"
					/>
					Match system settings
				</label>
			</Block>
		</Group>
	);
}

function Effects() {
	const { prefs, setPref } = usePreferences();
	return (
		<Group>
			<Row label="Enable glass effects" hint="Apply a see-through glassy material to many surfaces">
				<Switch
					aria-label="Enable glass effects"
					checked={prefs.glass === "on"}
					onCheckedChange={(on) => setPref("glass", on ? "on" : "off")}
				/>
			</Row>
			<SliderRow
				label="Noise overlay opacity"
				hint="Apply a coat of subtle noise to add variation to solid backgrounds"
				value={prefs.noise}
				min={0}
				max={NOISE_MAX}
				step={0.05}
				onChange={(v) => setPref("noise", v)}
				format={(v) => v.toFixed(2)}
			/>
			<SliderRow
				label="Card background vibrancy"
				hint="Bring some colour into your world (or reduce it)"
				value={prefs.vibrancy}
				min={0}
				max={VIBRANCY_MAX}
				step={0.1}
				onChange={(v) => setPref("vibrancy", Math.round(v * 10) / 10)}
			/>
		</Group>
	);
}

/** Read-only chips of the live palette, so a hue or theme change is visible at a glance. */
const SWATCHES = [
	["Body 2", "--b2"],
	["Body 3", "--b3"],
	["Body 4", "--b4"],
	["Body 5", "--b5"],
	["Text 3", "--l3-c"],
	["Text 4", "--l4-c"],
	["Fill 3", "--h3"],
	["Fill 4", "--h4"],
] as const;

function Palette_() {
	return (
		<Block keywords="colours colors palette body text fill swatches" className="flex flex-wrap justify-center gap-x-3 gap-y-2 px-4 py-4">
			{SWATCHES.map(([label, token]) => (
				<div key={token} className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
					<span
						className="block h-[18px] w-14 rounded-full shadow-[inset_0_0_0_1px_rgb(255_255_255/8%)]"
						style={{ background: `oklch(var(${token}))` }}
					/>
					{label}
				</div>
			))}
		</Block>
	);
}

function AccentPicker() {
	const { prefs, setPrefs } = usePreferences();
	const labelId = useId();
	return (
		<Row label="Presets" hint="Used for buttons, highlights and charts." labelId={labelId}>
			<div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap justify-end gap-2">
				{(Object.keys(ACCENTS) as Accent[]).map((accent) => {
					const checked = prefs.hue === null && prefs.accent === accent;
					const colour = `oklch(0.62 0.16 ${ACCENTS[accent].hue})`;
					return (
						<label
							key={accent}
							title={ACCENTS[accent].label}
							className="grid size-7 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110 active:scale-95 has-checked:ring-2 has-checked:ring-(--swatch) has-focus-visible:ring-2 has-focus-visible:ring-ring"
							style={{ background: colour, "--swatch": colour } as React.CSSProperties}
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
		<Row label="Custom hue" hint="Drag to pick any colour. Choosing a preset resets it." labelId={labelId}>
			<div className="flex items-center gap-3">
				<input
					type="range"
					min={0}
					max={359}
					value={hue}
					aria-labelledby={labelId}
					onChange={(e) => setPref("hue", Number(e.target.value))}
					className="h-2 w-48 cursor-pointer appearance-none rounded-full accent-primary"
					style={{ background: "linear-gradient(to right in oklch longer hue, oklch(0.7 0.15 0), oklch(0.7 0.15 359))" }}
				/>
				<span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{hue}°</span>
			</div>
		</Row>
	);
}

export function VisualTab() {
	return (
		<div className="flex flex-col gap-6">
			<Section id="themes" title="Themes" icon={Paintbrush}>
				<Themes />
				<Effects />
			</Section>
			<Section id="colours" title="Colours" icon={Palette}>
				<Group>
					<Palette_ />
					<AccentPicker />
					<HueSlider />
					<ChoiceRow name="vibrance" label="Vibrance" hint="How saturated surfaces and accents are." />
				</Group>
			</Section>
			<Section id="shape" title="Shape" icon={Sparkles}>
				<Group>
					<ChoiceRow name="radius" label="Corner radius" />
				</Group>
			</Section>
		</div>
	);
}
