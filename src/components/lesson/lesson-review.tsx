"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichContent } from "@/components/content/rich-content";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { orderOutline } from "@/lib/moodle/normalize-lesson";
import type { LessonInfo } from "@/types/lesson";

/** Read-only walk through the last attempt's pages, with Moodle's own rendering of the learner's answers. */
export function LessonReview({ lesson, password, onExit }: { lesson: LessonInfo; password?: string; onExit: () => void }) {
	const { client } = useMoodleConnection();
	const [index, setIndex] = useState(0);
	const outline = useMoodleQuery(client ? async () => orderOutline(await client.getLessonOutline(lesson.id, { password })) : null, [client, lesson.id, password]);
	const pageId = outline.data?.[index]?.id;
	const page = useMoodleQuery(client && pageId ? () => client.getLessonPage(lesson.id, pageId, { password, review: true }) : null, [client, lesson.id, pageId, password]);

	if (outline.error) return <ErrorState error={outline.error} />;
	if (outline.loading) return <ListSkeleton rows={3} />;
	const total = outline.data?.length ?? 0;
	if (!total) return <EmptyState title="Nothing to review" description="This lesson has no pages." />;
	if (page.error) return <ErrorState error={page.error} />;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<p className="text-xs text-muted-foreground">
					Review: page {index + 1} of {total}
				</p>
				<Button variant="ghost" size="sm" onClick={onExit}>
					Exit review
				</Button>
			</div>
			{page.data ? (
				<>
					<h2 className="text-xl font-medium">{page.data.title}</h2>
					<RichContent html={page.data.rendered || page.data.contents} className="rounded-xl border bg-card p-4" />
				</>
			) : (
				<ListSkeleton rows={2} />
			)}
			<div className="flex gap-2">
				<Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>
					<ChevronLeft aria-hidden="true" />
					Previous
				</Button>
				<Button variant="outline" disabled={index >= total - 1} onClick={() => setIndex(index + 1)}>
					Next
					<ChevronRight aria-hidden="true" />
				</Button>
			</div>
		</div>
	);
}
