"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { toast } from "@/lib/toast";
import type { Workshop, WorkshopAccess, WorkshopSubmission } from "@/types/workshop";
import { SubmissionDialog } from "./submission-dialog";
import { SubmissionView } from "./submission-view";

interface SubmissionPanelProps {
	workshop: Workshop;
	access: WorkshopAccess;
	mine: WorkshopSubmission | null;
	onChanged: () => void;
}

/** The user's own submission: add, edit or delete it while the workshop allows. */
export function SubmissionPanel({ workshop, access, mine, onChanged }: SubmissionPanelProps) {
	const { client } = useMoodleConnection();
	const [editing, setEditing] = useState(false);
	const [confirming, setConfirming] = useState(false);

	async function remove() {
		if (!client || !mine) return;
		try {
			await client.deleteWorkshopSubmission(mine.id);
			toast.success("Submission deleted");
			onChanged();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't delete your submission.");
		}
		setConfirming(false);
	}

	const canEdit = Boolean(mine) && access.canModifySubmission;
	return (
		<div className="flex flex-col gap-4">
			{workshop.instructAuthors && (
				<section className="rounded-xl border bg-card p-4">
					<h2 className="mb-1 text-sm font-medium">Instructions for submission</h2>
					<RichContent html={workshop.instructAuthors} />
				</section>
			)}
			{mine ? (
				<SubmissionView
					submission={mine}
					maxGrade={workshop.grade}
					actions={
						canEdit && (
							<div className="flex items-center gap-1">
								<Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
									<Pencil aria-hidden="true" />
									Edit
								</Button>
								{confirming ? (
									<>
										<Button variant="destructive" size="xs" onClick={() => void remove()}>Delete submission</Button>
										<Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>Keep</Button>
									</>
								) : (
									<Button variant="ghost" size="xs" onClick={() => setConfirming(true)}>
										<Trash2 aria-hidden="true" />
										Delete
									</Button>
								)}
							</div>
						)
					}
				/>
			) : (
				<EmptyState
					title="You haven't submitted yet"
					description={access.canCreateSubmission ? "Add your work so classmates can review it." : "Submissions aren't open right now."}
					action={
						access.canCreateSubmission && (
							<Button size="sm" onClick={() => setEditing(true)} className="mt-2">
								<Plus aria-hidden="true" />
								Add submission
							</Button>
						)
					}
				/>
			)}
			<SubmissionDialog workshop={workshop} existing={mine ?? undefined} open={editing} onOpenChange={setEditing} onSaved={onChanged} />
		</div>
	);
}
