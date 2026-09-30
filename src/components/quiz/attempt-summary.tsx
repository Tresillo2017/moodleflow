"use client";

import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { QuizNavItem } from "@/types/quiz";

interface AttemptSummaryProps {
	items: QuizNavItem[];
	busy: boolean;
	onGoTo: (item: QuizNavItem) => void;
	onReturn: () => void;
	onSubmit: () => void;
}

/** Answer status per question, then the confirmed "submit all and finish". */
export function AttemptSummary({ items, busy, onGoTo, onReturn, onSubmit }: AttemptSummaryProps) {
	const [confirming, setConfirming] = useState(false);
	const questions = items.filter((i) => i.answerable);
	const unanswered = questions.filter((i) => i.state !== "complete").length;

	return (
		<div className="flex flex-col gap-4">
			<h2 className="text-lg font-medium">Summary of attempt</h2>
			<div className="overflow-hidden rounded-xl border bg-card">
				<table className="w-full text-sm">
					<thead className="border-b text-left text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-2 font-medium">Question</th>
							<th className="px-4 py-2 font-medium">Status</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{questions.map((item) => (
							<tr key={item.slot}>
								<td className="px-4 py-2">
									<button type="button" onClick={() => onGoTo(item)} className="flex items-center gap-2 text-primary underline-offset-4 hover:underline">
										{item.number}
										{item.flagged && <Flag className="size-3.5 fill-warning text-warning" aria-label="Flagged" role="img" />}
									</button>
								</td>
								<td className="px-4 py-2 text-muted-foreground">{item.state === "complete" ? "Answer saved" : "Not yet answered"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button variant="outline" onClick={onReturn} disabled={busy}>
					Return to attempt
				</Button>
				<Button onClick={() => setConfirming(true)} disabled={busy}>
					{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
					Submit all and finish
				</Button>
			</div>

			<Dialog open={confirming} onOpenChange={(open: boolean) => !busy && setConfirming(open)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Submit all your answers?</DialogTitle>
						<DialogDescription>
							{unanswered > 0 ? `${unanswered} ${unanswered === 1 ? "question is" : "questions are"} still unanswered. ` : ""}
							Once you submit, you can't change your answers.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
							Cancel
						</Button>
						<Button onClick={onSubmit} disabled={busy}>
							{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
							Submit all and finish
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
