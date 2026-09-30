"use client";

import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichContent } from "@/components/content/rich-content";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import type { LessonFinish, LessonInfo } from "@/types/lesson";

/** End of the lesson: Moodle's messages, the attempt's numbers and the recorded grade. */
export function LessonSummary({ lesson, finish, onDone }: { lesson: LessonInfo; finish: LessonFinish; onDone: () => void }) {
	const { client } = useMoodleConnection();
	const grade = useMoodleQuery(client && lesson.grade > 0 ? () => client.getLessonGrade(lesson.id) : null, [client, lesson.id, lesson.grade]);
	const recorded = grade.data?.grade != null ? `${grade.data.formatted ?? grade.data.grade} / ${lesson.grade}` : null;

	return (
		<div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
			<Trophy className="size-7 text-primary" aria-hidden="true" />
			<h2 className="text-xl font-medium">Lesson complete</h2>
			{finish.messages.map((m) => (
				<RichContent key={m} html={m} />
			))}
			{(finish.results.length > 0 || recorded) && (
				<dl className="grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
					{finish.results.map((r) => (
						<div key={r.label} className="contents">
							<dt className="text-muted-foreground">{r.label}</dt>
							<dd className="text-right font-medium tabular-nums">{r.value}</dd>
						</div>
					))}
					{recorded && (
						<div className="contents">
							<dt className="text-muted-foreground">Recorded grade</dt>
							<dd className="text-right font-medium tabular-nums">{recorded}</dd>
						</div>
					)}
				</dl>
			)}
			<div>
				<Button onClick={onDone}>Back to lesson</Button>
			</div>
		</div>
	);
}
