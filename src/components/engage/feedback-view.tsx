"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState, ListSkeleton } from "@/components/ui/state";
import { FeedbackForm } from "@/components/engage/feedback-form";
import { FeedbackAnalysisView, FeedbackMyResponses } from "@/components/engage/feedback-analysis";
import { isWindowOpen } from "@/components/engage/engage-frame";
import { toast } from "@/lib/toast";
import type { Feedback, FeedbackAccess } from "@/types/engage";

type Tab = "form" | "analysis" | "mine";

/** Why the user can't start (or restart) this feedback, or null when they can. */
function blockedReason(feedback: Feedback, access: FeedbackAccess): string | null {
	if (!access.canComplete) return "You can't complete this feedback.";
	if (access.isEmpty) return "This feedback has no questions yet.";
	if (!access.isOpen || !isWindowOpen(feedback)) return "This feedback isn't open right now.";
	if (access.isAlreadySubmitted && (!feedback.multipleSubmit || !access.canSubmit)) return "You've already completed this feedback.";
	return null;
}

export function FeedbackView({ feedback, courseId }: { feedback: Feedback; courseId: number | null }) {
	const { client, refresh } = useMoodleConnection();
	const [version, setVersion] = useState(0);
	const access = useMoodleQuery(client ? () => client.getFeedbackAccess(feedback.id) : null, [client, feedback.id, version]);
	const [tab, setTab] = useState<Tab>("form");
	const [startPage, setStartPage] = useState<number | null>(null);
	const [starting, setStarting] = useState(false);

	if (access.loading) return <ListSkeleton rows={3} />;
	if (access.error) return <ErrorState error={access.error} onRetry={refresh} />;
	if (!access.data || !client) return null;
	const a = access.data;

	async function start() {
		if (!client) return;
		setStarting(true);
		try {
			setStartPage(await client.launchFeedback(feedback.id, courseId ?? feedback.courseId));
		} catch (e) {
			toast.error(e instanceof Error && e.message ? e.message : "Couldn't start the feedback.");
		} finally {
			setStarting(false);
		}
	}

	const blocked = blockedReason(feedback, a);
	const tabs: [Tab, string][] = [["form", "Feedback"], ...(a.canViewAnalysis ? [["analysis", "Analysis"] as [Tab, string]] : []), ...(a.isAlreadySubmitted && !feedback.anonymous ? [["mine", "Your response"] as [Tab, string]] : [])];

	return (
		<div className="flex flex-col gap-6">
			{tabs.length > 1 && (
				<Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
					<TabsList>
						{tabs.map(([value, label]) => (
							<TabsTrigger key={value} value={value}>
								{label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			)}
			{tab === "analysis" && <FeedbackAnalysisView feedbackId={feedback.id} />}
			{tab === "mine" && <FeedbackMyResponses feedbackId={feedback.id} />}
			{tab === "form" &&
				(startPage !== null ? (
					<FeedbackForm
						feedback={feedback}
						startPage={startPage}
						onClose={() => {
							setStartPage(null);
							setVersion((v) => v + 1);
						}}
					/>
				) : (
					<section className="flex flex-col items-start gap-3 rounded-xl border bg-card p-4">
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline">{feedback.anonymous ? "Anonymous" : "Names recorded"}</Badge>
							{a.isAlreadySubmitted && <Badge variant="secondary">Completed</Badge>}
						</div>
						{blocked && <p className="text-sm text-muted-foreground">{blocked}</p>}
						{!blocked && (
							<Button onClick={start} disabled={starting}>
								{starting && <Loader2 className="animate-spin" aria-hidden="true" />}
								{a.isAlreadySubmitted ? "Answer again" : "Start feedback"}
							</Button>
						)}
					</section>
				))}
		</div>
	);
}
