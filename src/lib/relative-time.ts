const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 365 * 86_400_000],
	["month", 30 * 86_400_000],
	["day", 86_400_000],
	["hour", 3_600_000],
	["minute", 60_000],
];

/** "30 minutes ago", "in 1 month", "now": the largest unit that fits, like bleh's date labels. */
export function relativeTime(from: Date | number, now: Date | number = Date.now()): string {
	const diff = new Date(from).getTime() - new Date(now).getTime();
	const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
	const [unit, ms] = UNITS.find(([, size]) => Math.abs(diff) >= size) ?? ["minute", 60_000];
	if (Math.abs(diff) < 60_000) return "just now";
	return formatter.format(Math.trunc(diff / ms), unit);
}
