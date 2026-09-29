"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, ClipboardX, Loader2 } from "lucide-react";
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
import { SubmissionComments } from "@/components/assignments/submission-comments";
import { canSubmit, isDone, submissionTiming, type TimingTone } from "@/lib/moodle/assignment";
import { cn } from "@/lib/utils";
import { courseHue } from "@/lib/format";
import type { MoodleAssignment } from "@/types/moodle";

const dateTime = (iso: string) =>
	new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
			{title && <h2 className="text-xl">{title}</h2>}
			{children}
		</section>
	);
}

const TONES: Record<TimingTone, string> = {
	success: "bg-success/10",
	warning: "bg-warning/10",
	danger: "bg-danger/10",
	neutral: "",
};

/** One row of the submission status table: label on the left, value on the right, optional tint. */
function StatusRow({ label, tone = "neutral", children }: { label: string; tone?: TimingTone; children: React.ReactNode }) {
	return (
		<div className={cn("grid gap-1 border-b px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4", TONES[tone])}>
			<dt className="font-medium">{label}</dt>
			<dd className="min-w-0">{children}</dd>
		</div>
	);
}

function submissionLabel(a: MoodleAssignment): { text: string; tone: TimingTone } {
	switch (a.submission?.status) {
		case "submitted":
			return { text: "Submitted for grading", tone: "success" };
		case "draft":
			return { text: "Draft (not submitted)", tone: "warning" };
		case "reopened":
			return { text: "Reopened for editing", tone: "warning" };
		default:
			return { text: "No submission", tone: "neutral" };
	}
}

function Actions({ assignment: a, onChanged }: { assignment: MoodleAssignment; onChanged: () => void }) {
	const { client } = useMoodleConnection();
	const [busy, setBusy] = useState(false);
	const [confirmingRemove, setConfirmingRemove] = useState(false);
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

	const removable =
		a.canEdit !== false && (a.submission?.status === "submitted" || a.submission?.status === "draft") && a.status !== "graded";

	async function remove() {
		if (!client) return;
		setBusy(true);
		try {
			await client.removeAssignmentSubmission(a.id);
			toast.success("Submission removed");
			onChanged();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't remove the submission.");
		} finally {
			setBusy(false);
			setConfirmingRemove(false);
		}
	}

	if (!editable && !readyForGrading && !removable) return null;
	return (
		<div className="flex flex-wrap items-center gap-2">
			{editable && <SubmitDialog assignment={a} onSubmitted={onChanged} />}
			{readyForGrading && (
				<Button size="sm" onClick={submitForGrading} disabled={busy}>
					{busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
					Submit for grading
				</Button>
			)}
			{removable &&
				(confirmingRemove ? (
					<>
						<Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
							{busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
							Confirm remove
						</Button>
						<Button size="sm" variant="ghost" onClick={() => setConfirmingRemove(false)} disabled={busy}>
							Cancel
						</Button>
					</>
				) : (
					<Button size="sm" variant="outline" onClick={() => setConfirmingRemove(true)}>
						Remove submission
					</Button>
				))}
		</div>
	);
}

export default function AssignmentDetailPage({ params }: { params: Promise<{ assignmentId: string }> }) {
	const { assignmentId } = use(params);
	const id = Number(assignmentId);
	const { client, refresh } = useMoodleConnection();
	const query = useMoodleQuery(client ? () => client.getAssignment(id) : null, [client, id]);
	const a = query.data;
	const timing = a ? submissionTiming(a) : undefined;

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

					<Section>
						<div className="flex flex-wrap items-center gap-2">
							{a.completion && (
								<span
									className={cn(
										"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
										a.completion.done ? "border-success/30 bg-success/10 text-success" : "text-muted-foreground",
									)}
								>
									{a.completion.done ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
									<span className="font-medium">{a.completion.done ? "Done:" : "To do:"}</span>
									{(a.completion.label ?? "Make a submission").replace(/^(To do|Done):\s*/i, "")}
								</span>
							)}
							<StatusBadge status={a.status} />
							{!isDone(a) && <DeadlineBadge dueDate={a.dueDate} />}
							{a.grade !== undefined && (
								<span className="text-sm font-medium tabular-nums">
									{a.grade}/{a.maxGrade ?? "—"}
								</span>
							)}
						</div>
						<dl className="flex flex-col gap-1 border-t pt-3 text-sm">
							{a.openDate && (
								<div className="flex gap-2">
									<dt className="font-medium">Opened:</dt>
									<dd className="text-muted-foreground">{dateTime(a.openDate)}</dd>
								</div>
							)}
							<div className="flex gap-2">
								<dt className="font-medium">Due:</dt>
								<dd className="text-muted-foreground">{a.dueDate ? dateTime(a.dueDate) : "No due date"}</dd>
							</div>
						</dl>
						{a.description && (
							<div className="border-t pt-3">
								<RichContent html={a.description} />
							</div>
						)}
						{a.introFiles && a.introFiles.length > 0 && (
							<div className="border-t pt-3">
								<FileList files={a.introFiles} />
							</div>
						)}
					</Section>

					<Actions assignment={a} onChanged={refresh} />

					<h2 className="text-2xl">Submission status</h2>
					<dl className="overflow-hidden rounded-xl border bg-card">
						<StatusRow label="Submission status" tone={submissionLabel(a).tone}>
							{submissionLabel(a).text}
						</StatusRow>
						<StatusRow label="Grading status" tone={a.status === "graded" ? "success" : "neutral"}>
							{a.status === "graded" ? "Graded" : "Not graded"}
						</StatusRow>
						{timing && (
							<StatusRow label="Time remaining" tone={timing.tone}>
								{timing.text}
							</StatusRow>
						)}
						{a.submission?.timeModified && a.submission.status !== "new" && (
							<StatusRow label="Last modified">{dateTime(a.submission.timeModified)}</StatusRow>
						)}
						{a.submission?.text && (
							<StatusRow label="Online text">
								<RichContent html={a.submission.text} />
							</StatusRow>
						)}
						{a.submission && a.submission.files.length > 0 && (
							<StatusRow label="File submissions">
								<FileList files={a.submission.files} />
							</StatusRow>
						)}
						{a.cmid !== undefined && a.submission?.id !== undefined && (
							<StatusRow label="Submission comments">
								<SubmissionComments assignment={a} />
							</StatusRow>
						)}
					</dl>

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
