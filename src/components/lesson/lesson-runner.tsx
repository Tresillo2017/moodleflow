"use client";

import { useState } from "react";
import { LessonOverview } from "@/components/lesson/lesson-overview";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { LessonReview } from "@/components/lesson/lesson-review";
import { LessonSummary } from "@/components/lesson/lesson-summary";
import { Button } from "@/components/ui/button";
import type { LessonFinish, LessonInfo } from "@/types/lesson";

type Phase =
	| { name: "overview" }
	| { name: "play"; startPageId: number; password?: string }
	| { name: "review"; password?: string }
	| { name: "done"; finish: LessonFinish };

/** Overview -> pages -> summary, plus review of the last attempt. */
export function LessonRunner({ lesson }: { lesson: LessonInfo }) {
	const [phase, setPhase] = useState<Phase>({ name: "overview" });
	const overview = () => setPhase({ name: "overview" });

	switch (phase.name) {
		case "overview":
			return <LessonOverview lesson={lesson} onPlay={(startPageId, password) => setPhase({ name: "play", startPageId, password })} onReview={(password) => setPhase({ name: "review", password })} />;
		case "play":
			return (
				<div className="flex flex-col gap-4">
					<div>
						<Button variant="ghost" size="sm" onClick={overview}>
							Leave lesson
						</Button>
					</div>
					<LessonPlayer lesson={lesson} startPageId={phase.startPageId} password={phase.password} onFinished={(finish) => setPhase({ name: "done", finish })} />
				</div>
			);
		case "review":
			return <LessonReview lesson={lesson} password={phase.password} onExit={overview} />;
		case "done":
			return <LessonSummary lesson={lesson} finish={phase.finish} onDone={overview} />;
	}
}
