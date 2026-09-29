"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useMoodleConnection } from "@/components/providers/moodle-provider";

interface SubmitDialogProps {
	assignmentId: number;
	assignmentName: string;
	onSubmitted?: () => void;
}

export function SubmitDialog({ assignmentId, assignmentName, onSubmitted }: SubmitDialogProps) {
	const { client } = useMoodleConnection();
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

	async function handleSubmit() {
		if (!client || !text.trim() || submitting) return;
		setSubmitting(true);
		try {
			await client.submitAssignmentText(assignmentId, text);
			toast.success("Submission sent");
			setOpen(false);
			setText("");
			onSubmitted?.();
		} catch {
			toast.error("Couldn't submit. Check your connection and try again.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button size="sm" variant="outline">
						<Send className="size-3.5" aria-hidden="true" />
						Submit
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{assignmentName}</DialogTitle>
					<DialogDescription>Submit an online text response for this assignment.</DialogDescription>
				</DialogHeader>
				<Textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
					}}
					placeholder="Write your submission…"
					rows={8}
					autoFocus
				/>
				<DialogFooter className="items-center sm:justify-between">
					<p className="text-xs text-muted-foreground tabular-nums">
						{wordCount} {wordCount === 1 ? "word" : "words"} · ⌘↵ to submit
					</p>
					<Button onClick={handleSubmit} disabled={submitting || !text.trim()}>
						{submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
						Submit assignment
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
