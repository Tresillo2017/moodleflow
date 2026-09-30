"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Button } from "@/components/ui/button";
import { ErrorState, ListSkeleton } from "@/components/ui/state";
import { OptionList } from "@/components/engage/option-list";
import { isWindowOpen } from "@/components/engage/engage-frame";
import { CHOICE_SHOW, type Choice, type ChoiceResult } from "@/types/engage";
import { toast } from "@/lib/toast";

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

function resultsNotice(choice: Choice, hasVoted: boolean, open: boolean): string | null {
	switch (choice.showResults) {
		case CHOICE_SHOW.always:
			return null;
		case CHOICE_SHOW.afterAnswer:
			return hasVoted ? null : "Results are shown once you've answered.";
		case CHOICE_SHOW.afterClose:
			return open ? "Results are shown after the choice closes." : null;
		default:
			return "The results of this choice aren't published to students.";
	}
}

function ResultBars({ results, showNames }: { results: ChoiceResult[]; showNames: boolean }) {
	return (
		<ul className="flex flex-col gap-4">
			{results.map((r) => (
				<li key={r.id} className="flex flex-col gap-1.5">
					<div className="flex items-baseline justify-between gap-3 text-sm">
						<span className="font-medium">{r.text}</span>
						<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
							{r.votes} {r.votes === 1 ? "vote" : "votes"} · {r.percent}%
						</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${r.percent}%`}>
						<div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, r.percent)}%` }} />
					</div>
					{showNames && r.voters.length > 0 && (
						<ul className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
							{r.voters.map((v) => (
								<li key={v.userId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<PersonAvatar name={v.fullName} imageUrl={v.imageUrl} size="sm" />
									{v.fullName}
								</li>
							))}
						</ul>
					)}
				</li>
			))}
		</ul>
	);
}

/** Vote, change or withdraw a vote, and see the results the teacher allows. */
export function ChoiceView({ choice }: { choice: Choice }) {
	const { client, refresh } = useMoodleConnection();
	const [version, setVersion] = useState(0);
	const options = useMoodleQuery(client ? () => client.getChoiceOptions(choice.id) : null, [client, choice.id, version]);
	const [selected, setSelected] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);

	const saved = (options.data ?? []).filter((o) => o.checked).map((o) => String(o.id));
	const hasVoted = saved.length > 0;
	const open = isWindowOpen(choice);
	const locked = !open || (hasVoted && !choice.allowUpdate);
	const notice = resultsNotice(choice, hasVoted, open);
	const savedKey = saved.join(",");

	useEffect(() => setSelected(savedKey ? savedKey.split(",") : []), [savedKey]);

	const results = useMoodleQuery<ChoiceResult[]>(client && options.data && !notice ? () => client.getChoiceResults(choice.id) : null, [client, choice.id, version, Boolean(options.data), Boolean(notice)]);

	if (options.loading) return <ListSkeleton rows={3} />;
	if (options.error) return <ErrorState error={options.error} onRetry={refresh} />;
	if (!client) return null;

	async function run(action: () => Promise<void>, done: string) {
		setBusy(true);
		try {
			await action();
			toast.success(done);
			setVersion((v) => v + 1);
		} catch (e) {
			toast.error(errorText(e, "Couldn't save that. Try again."));
		} finally {
			setBusy(false);
		}
	}

	const changed = selected.slice().sort().join(",") !== [...saved].sort().join(",");
	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
				<h2 className="text-sm font-medium">{choice.allowMultiple ? "Select one or more" : "Select one"}</h2>
				<OptionList
					name={`choice-${choice.id}`}
					label={choice.name}
					multiple={choice.allowMultiple}
					disabled={locked}
					value={selected}
					onChange={setSelected}
					options={(options.data ?? []).map((o) => ({
						value: String(o.id),
						disabled: o.disabled && !o.checked,
						label: (
							<span className="flex items-baseline justify-between gap-3">
								<span>{o.text}</span>
								{o.maxAnswers > 0 && (
									<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
										{o.count}/{o.maxAnswers} taken
									</span>
								)}
							</span>
						),
					}))}
				/>
				{!open && <p className="text-xs text-muted-foreground">This choice isn't open for answers.</p>}
				{open && hasVoted && !choice.allowUpdate && <p className="text-xs text-muted-foreground">You've answered, and this choice doesn't allow changes.</p>}
				{!locked && (
					<div className="flex flex-wrap gap-2">
						<Button disabled={busy || selected.length === 0 || (hasVoted && !changed)} onClick={() => run(() => client.submitChoice(choice.id, selected.map(Number)), hasVoted ? "Vote updated" : "Vote saved")}>
							{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
							{hasVoted ? "Update my vote" : "Save my vote"}
						</Button>
						{hasVoted && (
							<Button variant="outline" disabled={busy} onClick={() => run(() => client.deleteChoiceResponses(choice.id), "Vote removed")}>
								Remove my vote
							</Button>
						)}
					</div>
				)}
			</section>

			<section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
				<h2 className="text-sm font-medium">Results</h2>
				{notice && <p className="text-sm text-muted-foreground">{notice}</p>}
				{!notice && results.loading && <ListSkeleton rows={2} />}
				{!notice && results.error && <p className="text-sm text-muted-foreground">{results.error.message}</p>}
				{!notice && results.data && <ResultBars results={results.data} showNames={choice.publishNames} />}
			</section>
		</div>
	);
}
