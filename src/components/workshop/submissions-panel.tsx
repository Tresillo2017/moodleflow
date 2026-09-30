"use client";

import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/state";
import type { Workshop, WorkshopAccess, WorkshopSubmission } from "@/types/workshop";
import { SubmissionView } from "./submission-view";

interface SubmissionsPanelProps {
	workshop: Workshop;
	access: WorkshopAccess;
	/** Other people's submissions the user may see. */
	submissions: WorkshopSubmission[];
	nameOf: (userId: number) => string;
}

export function SubmissionsPanel({ workshop, access, submissions, nameOf }: SubmissionsPanelProps) {
	if (submissions.length === 0) return <EmptyState icon={Users} title="No other submissions to show" description="Classmates' work appears here when the workshop lets you see it." />;
	return (
		<div className="flex flex-col gap-3">
			{submissions.map((s) => (
				<SubmissionView key={s.id} submission={s} authorName={access.canViewAuthorNames ? nameOf(s.authorId) : undefined} maxGrade={workshop.grade} />
			))}
		</div>
	);
}
