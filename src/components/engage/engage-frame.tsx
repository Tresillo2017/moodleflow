"use client";

import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { PageHeader } from "@/components/layout/page-header";
import { RichContent } from "@/components/content/rich-content";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import type { MoodleQueryState } from "@/hooks/use-moodle-query";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function isWindowOpen({ timeOpen, timeClose }: { timeOpen?: string; timeClose?: string }, now = Date.now()) {
	return (!timeOpen || Date.parse(timeOpen) <= now) && (!timeClose || Date.parse(timeClose) > now);
}

/** Shared page chrome for choice, feedback and survey: back link, title, intro, availability window, then the activity itself. */
export function EngageFrame<T extends { name: string; intro?: string; timeOpen?: string; timeClose?: string }>({
	query,
	courseId,
	fallbackTitle,
	children,
}: {
	query: MoodleQueryState<T | null>;
	courseId: number | null;
	fallbackTitle: string;
	children: (item: T) => React.ReactNode;
}) {
	const { refresh } = useMoodleConnection();
	const item = query.data;
	return (
		<div className="flex flex-col gap-6">
			<Link href={courseId ? `/courses/${courseId}` : "/courses"} className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				Back to course
			</Link>
			<PageHeader title={item?.name ?? fallbackTitle} />
			{query.loading && <ListSkeleton rows={3} />}
			{query.error && <ErrorState error={query.error} onRetry={refresh} />}
			{!query.loading && !query.error && !item && <EmptyState icon={FileQuestion} title="Activity not found" description="It may have been removed, or it isn't in a course you're enrolled in." />}
			{item && (
				<>
					{item.intro && <RichContent html={item.intro} className="rounded-xl border bg-card p-4" />}
					{(item.timeOpen || item.timeClose) && (
						<p className="text-xs text-muted-foreground">
							{item.timeOpen && `Opens ${when(item.timeOpen)}`}
							{item.timeOpen && item.timeClose && " · "}
							{item.timeClose && `Closes ${when(item.timeClose)}`}
						</p>
					)}
					{children(item)}
				</>
			)}
		</div>
	);
}
