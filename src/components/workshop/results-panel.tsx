"use client";

import { useState } from "react";
import { Award } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import type { Workshop, WorkshopAccess, WorkshopAssessment, WorkshopGrades, WorkshopSubmission } from "@/types/workshop";
import { AssessmentDialog } from "./assessment-dialog";

function GradeCard({ label, value, max }: { label: string; value?: number; max: number }) {
	return (
		<div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
			<p className="text-xs text-muted-foreground">{label}</p>
			{value === undefined ? (
				<p className="text-sm text-muted-foreground">Not graded yet</p>
			) : (
				<p className="text-2xl tabular-nums">
					{Math.round(value * 100) / 100}
					<span className="text-sm text-muted-foreground"> / {max}</span>
				</p>
			)}
		</div>
	);
}

interface ResultsPanelProps {
	workshop: Workshop;
	access: WorkshopAccess;
	mine: WorkshopSubmission | null;
	nameOf: (userId: number) => string;
}

/** Final grades plus the assessments classmates wrote about the user's submission. */
export function ResultsPanel({ workshop, access, mine, nameOf }: ResultsPanelProps) {
	const { client } = useMoodleConnection();
	const [viewing, setViewing] = useState<WorkshopAssessment | null>(null);
	const data = useMoodleQuery(
		client
			? async () => {
					const [grades, received] = await Promise.all([
						client.getWorkshopGrades(workshop.id).catch((): WorkshopGrades => ({})),
						// not every role or phase may read these; that just means nothing to show yet
						mine ? client.getSubmissionAssessments(mine.id).catch(() => []) : Promise.resolve([]),
					]);
					return { grades, received };
				}
			: null,
		[client, workshop.id, mine?.id],
	);

	if (data.loading) return <ListSkeleton rows={2} />;
	if (data.error || !data.data) return data.error ? <ErrorState error={data.error} /> : null;
	const { grades, received } = data.data;

	return (
		<div className="flex flex-col gap-4">
			<div className="grid gap-3 sm:grid-cols-2">
				<GradeCard label="Grade for your submission" value={grades.submission} max={workshop.grade} />
				<GradeCard label="Grade for your assessments" value={grades.assessment} max={workshop.gradingGrade} />
			</div>
			<h2 className="text-sm font-medium">Assessments of your submission</h2>
			{received.length === 0 ? (
				<EmptyState icon={Award} title="No assessments to show yet" description={mine ? "They appear once your classmates have assessed your work, if the workshop shows them to you." : "Submit your work to receive assessments."} />
			) : (
				<ul className="flex flex-col gap-2">
					{received.map((a, i) => (
						<li key={a.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
							<div className="flex flex-wrap items-center gap-2">
								<span className="flex-1 text-sm font-medium">{access.canViewReviewerNames ? nameOf(a.reviewerId) : `Reviewer ${i + 1}`}</span>
								{a.grade !== undefined && <Badge variant="secondary" className="tabular-nums">{Math.round(a.grade * 10) / 10}%</Badge>}
								<Button variant="ghost" size="xs" onClick={() => setViewing(a)}>Details</Button>
							</div>
							{a.feedbackAuthor && <RichContent html={a.feedbackAuthor} className="text-muted-foreground" />}
						</li>
					))}
				</ul>
			)}
			{viewing && <AssessmentDialog workshop={workshop} assessmentId={viewing.id} mode="view" title="Assessment of your submission" open onOpenChange={(next) => !next && setViewing(null)} />}
		</div>
	);
}
