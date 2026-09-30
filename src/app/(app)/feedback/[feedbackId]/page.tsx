"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { useFeedback } from "@/hooks/use-engage";
import { EngageFrame } from "@/components/engage/engage-frame";
import { FeedbackView } from "@/components/engage/feedback-view";
import { FeatureGate, ListSkeleton } from "@/components/ui/state";

function FeedbackContent({ feedbackId }: { feedbackId: number }) {
	const courseId = Number(useSearchParams().get("course")) || null;
	const query = useFeedback(feedbackId, courseId);
	return (
		<EngageFrame query={query} courseId={courseId} fallbackTitle="Feedback">
			{(feedback) => <FeedbackView feedback={feedback} courseId={courseId} />}
		</EngageFrame>
	);
}

export default function FeedbackPage({ params }: { params: Promise<{ feedbackId: string }> }) {
	const { feedbackId } = use(params);
	return (
		<FeatureGate feature="Feedback" functions={["mod_feedback_get_page_items", "mod_feedback_process_page"]}>
			<Suspense fallback={<ListSkeleton rows={3} />}>
				<FeedbackContent feedbackId={Number(feedbackId)} />
			</Suspense>
		</FeatureGate>
	);
}
