"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { assessmentValues, isAssessmentComplete } from "@/lib/moodle/normalize-workshop";
import { toast } from "@/lib/toast";
import { MoodleError } from "@/types/moodle";
import type { AssessmentForm, AssessmentValues, Workshop, WorkshopSubmission } from "@/types/workshop";
import { AssessmentFields, AssessmentSummary } from "./assessment-fields";
import { OpenInMoodle } from "./open-in-moodle";
import { SubmissionView } from "./submission-view";

const htmlToText = (html: string) => new DOMParser().parseFromString(html.replace(/<\/p>\s*<p>|<br\s*\/?>/gi, "\n"), "text/html").body.textContent?.trim() ?? "";
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const textToHtml = (text: string) => (text.trim() ? text.trim().split(/\n+/).map((line) => `<p>${escapeHtml(line)}</p>`).join("") : "");

/** Comments are plain text while editing and Moodle HTML on the wire. */
function mapComments(values: AssessmentValues, convert: (comment: string) => string): AssessmentValues {
	return { ...values, dimensions: Object.fromEntries(Object.entries(values.dimensions).map(([i, d]) => [i, { ...d, comment: convert(d.comment ?? "") }])) };
}

interface AssessmentDialogProps {
	workshop: Workshop;
	assessmentId: number;
	/** "edit" fills the form in; "view" shows a finished assessment read-only. */
	mode: "edit" | "view";
	/** The work being assessed, shown above the form when known. */
	submission?: WorkshopSubmission;
	title: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved?: () => void;
}

export function AssessmentDialog({ open, onOpenChange, title, ...rest }: AssessmentDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{rest.workshop.name}</DialogDescription>
				</DialogHeader>
				{open && <AssessmentBody {...rest} onClose={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function AssessmentBody({ workshop, assessmentId, mode, submission, onSaved, onClose }: Omit<AssessmentDialogProps, "open" | "onOpenChange" | "title"> & { onClose: () => void }) {
	const { client } = useMoodleConnection();
	const form = useMoodleQuery(client ? () => client.getWorkshopAssessmentForm(assessmentId, workshop.strategy, mode === "edit" ? "assessment" : "preview") : null, [client, assessmentId, workshop.strategy, mode]);

	if (form.loading) return <Skeleton className="h-48 w-full rounded-lg" />;
	if (form.error || !form.data) return <ErrorState error={form.error ?? new MoodleError("malformed_response", "Moodle didn't send the assessment form.")} />;
	if (!form.data.supported) {
		return (
			<div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4 text-sm">
				<p>MoodleFlow can&apos;t show this assessment form (grading strategy “{workshop.strategy}”). You can complete it in Moodle.</p>
				<OpenInMoodle cmid={workshop.cmid} />
			</div>
		);
	}
	return (
		<>
			{submission && mode === "edit" && <SubmissionView submission={submission} />}
			{mode === "edit" ? (
				<AssessmentEditor form={form.data} onSaved={() => { onSaved?.(); onClose(); }} onCancel={onClose} />
			) : (
				<div className="flex flex-col gap-3">
					<AssessmentSummary form={form.data} values={assessmentValues(form.data)} />
					{form.data.feedback && (
						<div className="rounded-lg bg-muted/50 p-3">
							<p className="mb-1 text-xs font-medium text-muted-foreground">Overall feedback</p>
							<RichContent html={form.data.feedback} />
						</div>
					)}
				</div>
			)}
		</>
	);
}

function AssessmentEditor({ form, onSaved, onCancel }: { form: AssessmentForm; onSaved: () => void; onCancel: () => void }) {
	const { client } = useMoodleConnection();
	const [values, setValues] = useState(() => mapComments(assessmentValues(form), htmlToText));
	const [busy, setBusy] = useState(false);
	const complete = isAssessmentComplete(form, values);

	async function save() {
		if (!client || busy || !complete) return;
		setBusy(true);
		try {
			await client.saveWorkshopAssessment(form, mapComments(values, textToHtml));
			toast.success("Assessment saved");
			onSaved();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't save your assessment. Try again.");
			setBusy(false);
		}
	}

	return (
		<>
			<AssessmentFields form={form} values={values} onChange={setValues} />
			<div className="flex flex-col gap-1.5">
				<p className="text-sm font-medium">Overall feedback for the author</p>
				<RichTextEditor initialHtml={form.feedback} onChange={(feedback) => setValues((v) => ({ ...v, feedback }))} placeholder="Optional" minRows={3} label="Overall feedback" />
			</div>
			<DialogFooter className="items-center sm:justify-between">
				<p className="text-xs text-muted-foreground">{complete ? "Ready to save." : "Grade every criterion to save."}</p>
				<div className="flex gap-2">
					<Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
					<Button onClick={() => void save()} disabled={busy || !complete}>
						{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
						Save assessment
					</Button>
				</div>
			</DialogFooter>
		</>
	);
}
