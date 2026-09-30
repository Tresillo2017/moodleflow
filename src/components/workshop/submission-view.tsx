"use client";

import { RichContent } from "@/components/content/rich-content";
import { FileList } from "@/components/files/file-list";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "@/lib/format";
import type { WorkshopSubmission } from "@/types/workshop";

interface SubmissionViewProps {
	submission: WorkshopSubmission;
	/** Shown under the title; omit for your own submission. */
	authorName?: string;
	/** Grade out of this many points, when the submission has one. */
	maxGrade?: number;
	actions?: React.ReactNode;
}

/** A submission's title, text, files and (once graded) grade and teacher feedback. */
export function SubmissionView({ submission, authorName, maxGrade, actions }: SubmissionViewProps) {
	const grade = submission.gradeOverride ?? submission.grade;
	return (
		<article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
			<header className="flex flex-wrap items-start justify-between gap-2">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h3 className="text-base font-medium text-balance">{submission.title}</h3>
					<p className="text-xs text-muted-foreground">
						{authorName && <>{authorName} · </>}
						<time dateTime={submission.timeModified}>{formatDistanceToNow(submission.timeModified)}</time>
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{submission.late && <Badge variant="destructive">Late</Badge>}
					{grade !== undefined && (
						<Badge variant="secondary" className="tabular-nums">
							{grade}
							{maxGrade ? ` / ${maxGrade}` : ""}
						</Badge>
					)}
					{actions}
				</div>
			</header>
			{submission.content && <RichContent html={submission.content} />}
			{submission.files.length > 0 && <FileList files={submission.files} />}
			{submission.feedback && (
				<div className="rounded-lg bg-muted/50 p-3">
					<p className="mb-1 text-xs font-medium text-muted-foreground">Teacher feedback</p>
					<RichContent html={submission.feedback} />
				</div>
			)}
		</article>
	);
}
