"use client";

import { useState } from "react";
import { ClipboardCheck, Eye, Pencil } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useReload } from "@/hooks/use-workshop";
import type { Workshop, WorkshopAccess, WorkshopAssessment, WorkshopSubmission } from "@/types/workshop";
import { AssessmentDialog } from "./assessment-dialog";

interface Review {
	assessment: WorkshopAssessment;
	/** Undefined when Moodle wouldn't show us the work (e.g. removed). */
	submission?: WorkshopSubmission;
}

interface ReviewPanelProps {
	workshop: Workshop;
	access: WorkshopAccess;
	nameOf: (userId: number) => string;
	onChanged: () => void;
}

/** Peer assessments assigned to the user: open one to grade the classmate's work. */
export function ReviewPanel({ workshop, access, nameOf, onChanged }: ReviewPanelProps) {
	const { client } = useMoodleConnection();
	const [version, reload] = useReload();
	const [open, setOpen] = useState<Review | null>(null);
	const reviews = useMoodleQuery<Review[]>(
		client
			? async () => {
					const assessments = await client.getWorkshopReviews(workshop.id);
					return Promise.all(assessments.map(async (assessment) => ({ assessment, submission: await client.getWorkshopSubmission(assessment.submissionId).catch(() => undefined) })));
				}
			: null,
		[client, workshop.id, version],
	);

	if (reviews.loading) return <ListSkeleton rows={2} />;
	if (reviews.error) return <ErrorState error={reviews.error} onRetry={reload} />;
	const list = reviews.data ?? [];

	return (
		<div className="flex flex-col gap-4">
			{workshop.instructReviewers && (
				<section className="rounded-xl border bg-card p-4">
					<h2 className="mb-1 text-sm font-medium">Instructions for assessment</h2>
					<RichContent html={workshop.instructReviewers} />
				</section>
			)}
			{list.length === 0 ? (
				<EmptyState icon={ClipboardCheck} title="Nothing to assess" description={workshop.phase === "assessment" ? "No submissions have been assigned to you." : "Assessments are assigned when the assessment phase starts."} />
			) : (
				<ul className="flex flex-col gap-2">
					{list.map((r) => {
						const done = r.assessment.grade !== undefined;
						const label = r.submission?.title ?? `Submission ${r.assessment.submissionId}`;
						return (
							<li key={r.assessment.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
								<div className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="truncate text-sm font-medium">{label}</span>
									{r.submission && access.canViewAuthorNames && <span className="text-xs text-muted-foreground">{nameOf(r.submission.authorId)}</span>}
								</div>
								<Badge variant={done ? "secondary" : "outline"} className="tabular-nums">
									{done ? `${Math.round(r.assessment.grade ?? 0)}%` : "To do"}
								</Badge>
								<Button variant="outline" size="sm" onClick={() => setOpen(r)}>
									{access.canAssessNow ? <Pencil aria-hidden="true" /> : <Eye aria-hidden="true" />}
									{access.canAssessNow ? (done ? "Edit assessment" : "Assess") : "View"}
								</Button>
							</li>
						);
					})}
				</ul>
			)}
			{open && (
				<AssessmentDialog
					workshop={workshop}
					assessmentId={open.assessment.id}
					mode={access.canAssessNow ? "edit" : "view"}
					submission={open.submission}
					title={open.submission?.title ?? "Assessment"}
					open
					onOpenChange={(next) => !next && setOpen(null)}
					onSaved={() => {
						reload();
						onChanged();
					}}
				/>
			)}
		</div>
	);
}
