"use client";

import { useId } from "react";
import { Calendar, Egg, Flower2, Ghost, Leaf, PartyPopper, Rainbow, Snowflake, Sun, TreePine } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Switch } from "@/components/ui/switch";
import { CHOICES, activeSeason, seasonSpan, seasonTimeline, type Preferences, type SeasonName, type SeasonSpan } from "@/lib/preferences";
import { relativeTime } from "@/lib/relative-time";
import { Block, ChoiceRow, Group, Row, Section } from "./settings-ui";

const ICONS: Record<SeasonName, React.ElementType> = {
	new_years: PartyPopper,
	easter: Egg,
	pride: Rainbow,
	summer: Sun,
	halloween: Ghost,
	pre_fall: Leaf,
	fall: Leaf,
	christmas: TreePine,
};

const seasonLabel = (name: SeasonName) => CHOICES.season[name];

function TimelineItem({ span, now, current }: { span: SeasonSpan | null; now: Date; current?: boolean }) {
	if (!span) return <div className="st-timeline-item" />;
	const Icon = ICONS[span.name];
	return (
		<div className="st-timeline-item" data-current={current ? "" : undefined}>
			<Icon aria-hidden="true" />
			<strong>{seasonLabel(span.name)}</strong>
			<span>{current ? "Current" : relativeTime(span.start > now ? span.start : span.end, now)}</span>
		</div>
	);
}

function Timeline() {
	const now = new Date();
	const { previous, current, next } = seasonTimeline(now);
	return (
		<Block keywords="seasonal timeline summer halloween autumn fall christmas season" className="st-timeline">
			<TimelineItem span={previous} now={now} />
			{current ? <TimelineItem span={current} now={now} current /> : <div className="st-timeline-item" data-current=""><Calendar aria-hidden="true" /><strong>Between seasons</strong><span>Current</span></div>}
			<TimelineItem span={next} now={now} />
		</Block>
	);
}

const PARTICLES = [
	{ value: "normal", label: "Show full particles" },
	{ value: "less", label: "Show less particles" },
	{ value: "none", label: "Disable particles" },
] as const;

function Particles() {
	const { prefs, setPref } = usePreferences();
	const name = useId();
	return (
		<Block keywords="particles snow snowflakes falling" className="flex flex-col gap-1 px-4 py-3">
			<p id={`${name}-label`} className="text-sm font-medium">
				Show particles during select seasons
			</p>
			<p className="text-xs text-muted-foreground">During colder seasons, watch pretty snowflakes fall ❆ ⋆ ˚ ｡</p>
			<div role="radiogroup" aria-labelledby={`${name}-label`} className="mt-2 flex flex-col gap-2">
				{PARTICLES.map(({ value, label }) => (
					<label key={value} className="flex w-fit cursor-pointer items-center gap-3 text-sm">
						<input
							type="radio"
							name={name}
							value={value}
							checked={prefs.particles === value}
							onChange={() => setPref("particles", value as Preferences["particles"])}
							className="size-4 cursor-pointer accent-(--sh-accent)"
						/>
						{label}
					</label>
				))}
			</div>
		</Block>
	);
}

export function SeasonalTab() {
	const { prefs, setPref } = usePreferences();
	const auto = prefs.season === "auto";
	const active = activeSeason(prefs);
	const now = new Date();
	const span = active ? seasonSpan(active, now.getFullYear()) : null;
	const ActiveIcon = active ? ICONS[active] : Flower2;
	return (
		<div className="flex flex-col gap-6">
			<Section id="seasonal" title="Seasonal timeline" icon={Leaf}>
				<Timeline />
				<Group>
					<Row label="Automatically adapt to seasonal events" hint="Adapts the default colour and decoration, and shows particles depending on the season">
						<Switch
							aria-label="Automatically adapt to seasonal events"
							checked={auto}
							onCheckedChange={(on) => setPref("season", on ? "auto" : "none")}
						/>
					</Row>
					{!auto && <ChoiceRow name="season" label="Season" hint="Pick a season yourself, or turn on automatic above." />}
					<Row label="Current season">
						<span className="flex items-center gap-1.5 text-sm text-(--sh-accent)">
							<ActiveIcon className="size-4" aria-hidden="true" />
							{active ? seasonLabel(active) : "None"}
						</span>
					</Row>
					{span && (
						<>
							<Row label="Start date">
								<span className="text-sm text-muted-foreground">{relativeTime(span.start, now)}</span>
							</Row>
							<Row label="End date">
								<span className="text-sm text-muted-foreground">{relativeTime(span.end, now)}</span>
							</Row>
						</>
					)}
				</Group>
			</Section>
			<Section id="particles" title="Particles" icon={Snowflake}>
				<Group>
					<Particles />
					<ChoiceRow name="overlays" label="Seasonal overlays" hint="Icicles and other decoration at the top of cards." />
				</Group>
			</Section>
		</div>
	);
}

