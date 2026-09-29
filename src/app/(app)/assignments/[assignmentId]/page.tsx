"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ClipboardX, Loader2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { StatusBadge } from "@/components/assignments/status-badge";
import { SubmitDialog } from "@/components/assignments/submit-dialog";
import { RichContent } from "@/components/content/rich-content";
import { FileList } from "@/components/files/file-list";
import { canSubmit } from "@/lib/moodle/assignment";
import { courseHue } from "@/lib/format";
import type { MoodleAssignment } from "@/types/moodle";

const dateTime = (iso: string) =>
	new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
			<h2 className="text-sm font-medium">{title}</h2>
			{children}
		</section>
	);
}

function Actions({ assignment: a, onChanged }: { assignment: MoodleAssignment; onChanged: () => void }) {
	const { client } = useMoodleConnection();
	const [busy, setBusy] = useState(false);
	const editable = canSubmit(a) || ((a.status === "submitted" || a.status === "late") && a.canEdit === true);
	const readyForGrading = a.status === "draft" && a.config?.requiresSubmitAction && a.canEdit !== false;

	async function submitForGrading() {
		if (!client) return;
		setBusy(true);
		try {
			await client.submitAssignmentForGrading(a.id);
			toast.success("Submitted for grading");
			onChanged();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't submit. Try again.");
		} finally {
			setBusy(false);
		}
	}

	if (!editable && !readyForGrading) return null;
	return (
		<div className="flex flex-wrap items-center gap-2">
			{editable && <SubmitDialog assignment={a} onSubmitted={onChanged} />}
			{readyForGrading && (
				<Button size="sm" onClick={submitForGrading} disabled={busy}>
					{busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
					Submit for grading
				</Button>
			)}
		</div>
	);
}

export default function AssignmentDetailPage({ params }: { params: Promise<{ assignmentId: string }> }) {
	const { assignmentId } = use(params);
	const id = Number(assignmentId);
	const { client, refresh } = useMoodleConnection();
	const query = useMoodleQuery(client ? () => client.getAssignment(id) : null, [client, id]);
	const a = query.data;

	return (
		<div className="flex flex-col gap-6">
			<Link
				href="/assignments"
				className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				All assignments
			</Link>

			{query.loading && <ListSkeleton rows={3} />}
			{query.error && <ErrorState error={query.error} onRetry={refresh} />}
			{query.data === undefined && !query.loading && !query.error && (
				<EmptyState icon={ClipboardX} title="Assignment not found" description="It may have been removed or you no longer have access." />
			)}

			{a && (
				<>
					<PageHeader
						eyebrow={
							<Link href={`/courses/${a.courseId}`} className="flex items-center gap-2 hover:text-foreground">
								<span
									className="size-2 rounded-full"
									style={{ background: `oklch(0.68 0.15 ${courseHue(a.courseId)})` }}
									aria-hidden="true"
								/>
								<span className="tracking-wide uppercase">{a.courseName}</span>
							</Link>
						}
						title={a.name}
					/>

					<div className="flex flex-wrap items-center gap-2 text-sm">
						<StatusBadge status={a.status} />
						{a.status !== "graded" && a.status !== "submitted" && a.status !== "late" && <DeadlineBadge dueDate={a.dueDate} />}
						{a.dueDate ? (
							<span className="text-muted-foreground">Due {dateTime(a.dueDate)}</span>
						) : (
							<span className="text-muted-foreground">No due date</span>
						)}
						{a.grade !== undefined && (
							<span className="font-medium tabular-nums">
								{a.grade}/{a.maxGrade ?? "—"}
							</span>
						)}
					</div>

					<Actions assignment={a} onChanged={refresh} />

					{a.description && (
						<Section title="Description">
							<RichContent html={a.description} />
						</Section>
					)}

					{a.introFiles && a.introFiles.length > 0 && (
						<Section title="Attachments">
							<FileList files={a.introFiles} />
						</Section>
					)}

					{a.submission && a.submission.status !== "new" && (
						<Section title="Your submission">
							<p className="text-xs text-muted-foreground">
								{a.submission.status === "draft" ? "Draft" : "Submitted"}
								{a.submission.timeModified && ` · last modified ${dateTime(a.submission.timeModified)}`}
							</p>
							{a.submission.text && <RichContent html={a.submission.text} />}
							{a.submission.files.length > 0 && <FileList files={a.submission.files} />}
						</Section>
					)}

					{(a.feedback || (a.feedbackFiles && a.feedbackFiles.length > 0) || a.grade !== undefined) && (
						<Section title="Grade and feedback">
							{a.grade !== undefined && (
								<p className="text-2xl font-semibold tabular-nums">
									{a.grade}
									<span className="text-base font-normal text-muted-foreground"> / {a.maxGrade ?? "—"}</span>
								</p>
							)}
							{a.gradedDate && <p className="text-xs text-muted-foreground">Graded {dateTime(a.gradedDate)}</p>}
							{a.feedback && <RichContent html={a.feedback} />}
							{a.feedbackFiles && a.feedbackFiles.length > 0 && <FileList files={a.feedbackFiles} />}
						</Section>
					)}
				</>
			)}
		</div>
	);
}
