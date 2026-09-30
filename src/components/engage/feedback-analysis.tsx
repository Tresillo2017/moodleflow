"use client";

import { BarChart3, ClipboardList } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import type { FeedbackAnalysisItem } from "@/types/engage";

function AnalysisCard({ item }: { item: FeedbackAnalysisItem }) {
	const empty = !item.choices.length && !item.texts.length && !item.stats.length;
	return (
		<li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
			<h3 className="text-sm font-medium">{item.name}</h3>
			{empty && <p className="text-sm text-muted-foreground">No answers yet.</p>}
			{item.choices.length > 0 && (
				<ul className="flex flex-col gap-2.5">
					{item.choices.map((c) => (
						<li key={c.label} className="flex flex-col gap-1">
							<div className="flex items-baseline justify-between gap-3 text-sm">
								<span>{c.label}</span>
								<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
									{c.count} · {c.percent}%
								</span>
							</div>
							<div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${c.percent}%`}>
								<div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, c.percent)}%` }} />
							</div>
						</li>
					))}
				</ul>
			)}
			{item.stats.length > 0 && (
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
					{item.stats.map((s) => (
						<div key={s.label} className="contents">
							<dt className="text-muted-foreground capitalize">{s.label}</dt>
							<dd className="tabular-nums">{s.value}</dd>
						</div>
					))}
				</dl>
			)}
			{item.texts.length > 0 && (
				<ul className="flex flex-col divide-y rounded-lg border">
					{item.texts.map((t, i) => (
						// biome-ignore lint: free-text answers have no stable id
						<li key={i} className="px-3 py-2 text-sm whitespace-pre-wrap">
							{t}
						</li>
					))}
				</ul>
			)}
		</li>
	);
}

/** Aggregated answers across everyone who completed the feedback. */
export function FeedbackAnalysisView({ feedbackId }: { feedbackId: number }) {
	const { client, refresh } = useMoodleConnection();
	const query = useMoodleQuery(client ? () => client.getFeedbackAnalysis(feedbackId) : null, [client, feedbackId]);
	if (query.loading) return <ListSkeleton rows={3} />;
	if (query.error) return <ErrorState error={query.error} onRetry={refresh} />;
	if (!query.data?.items.length) return <EmptyState icon={BarChart3} title="No analysis yet" description="Results appear here once people have completed the feedback." />;
	return (
		<div className="flex flex-col gap-4">
			<p className="text-sm text-muted-foreground">
				{query.data.completedCount} {query.data.completedCount === 1 ? "response" : "responses"}
			</p>
			<ul className="flex flex-col gap-4">
				{query.data.items.map((item) => (
					<AnalysisCard key={item.id} item={item} />
				))}
			</ul>
		</div>
	);
}

/** The user's own last finished attempt. */
export function FeedbackMyResponses({ feedbackId }: { feedbackId: number }) {
	const { client, refresh } = useMoodleConnection();
	const query = useMoodleQuery(client ? () => client.getFeedbackFinishedResponses(feedbackId) : null, [client, feedbackId]);
	if (query.loading) return <ListSkeleton rows={3} />;
	if (query.error) return <ErrorState error={query.error} onRetry={refresh} />;
	if (!query.data?.length) return <EmptyState icon={ClipboardList} title="No saved responses" description="Moodle doesn't keep a readable copy of anonymous responses." />;
	return (
		<dl className="flex flex-col divide-y rounded-xl border bg-card">
			{query.data.map((r) => (
				<div key={r.id} className="flex flex-col gap-0.5 px-4 py-3">
					<dt className="text-xs text-muted-foreground">{r.name}</dt>
					<dd className="text-sm whitespace-pre-wrap">{r.value || "—"}</dd>
				</div>
			))}
		</dl>
	);
}
