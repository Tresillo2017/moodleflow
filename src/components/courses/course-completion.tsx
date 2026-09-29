"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { toast } from "@/lib/toast";

/** Course completion criteria and, when the course allows it, the self-complete button. Hidden without tracking. */
export function CourseCompletionCard({ courseId }: { courseId: number }) {
	const { client, refresh } = useMoodleConnection();
	const query = useMoodleQuery(client ? () => client.getCourseCompletion(courseId) : null, [client, courseId]);
	const [busy, setBusy] = useState(false);
	const c = query.data;
	if (!c || c.criteria.length === 0) return null;

	async function selfComplete() {
		setBusy(true);
		try {
			await client?.selfCompleteCourse(courseId);
			toast.success("Marked the course as complete");
			refresh();
		} catch {
			toast.error("Couldn't complete the course", { description: "Moodle rejected the change." });
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className="rounded-xl border bg-card px-4 py-3" aria-label="Course completion">
			<div className="flex items-center gap-3">
				<h2 className="flex-1 text-base">{c.completed ? "Course completed" : "Course completion"}</h2>
				{c.canSelfComplete && !c.completed && (
					<Button size="sm" variant="outline" disabled={busy} onClick={selfComplete}>
						Mark course complete
					</Button>
				)}
			</div>
			<ul className="mt-2 flex flex-col gap-1 text-sm">
				{c.criteria.map((k, i) => (
					<li key={i} className="flex items-center gap-2 text-muted-foreground">
						{k.complete ? <CheckCircle2 className="size-4 text-success" aria-label="Done" /> : <Circle className="size-4" aria-label="Not done" />}
						{k.title}
					</li>
				))}
			</ul>
		</section>
	);
}
