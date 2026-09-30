"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { useChoice } from "@/hooks/use-engage";
import { EngageFrame } from "@/components/engage/engage-frame";
import { ChoiceView } from "@/components/engage/choice-view";
import { FeatureGate, ListSkeleton } from "@/components/ui/state";

function ChoiceContent({ choiceId }: { choiceId: number }) {
	const courseId = Number(useSearchParams().get("course")) || null;
	const query = useChoice(choiceId, courseId);
	return (
		<EngageFrame query={query} courseId={courseId} fallbackTitle="Choice">
			{(choice) => <ChoiceView choice={choice} />}
		</EngageFrame>
	);
}

export default function ChoicePage({ params }: { params: Promise<{ choiceId: string }> }) {
	const { choiceId } = use(params);
	return (
		<FeatureGate feature="Choice" functions={["mod_choice_get_choice_options", "mod_choice_submit_choice_response"]}>
			<Suspense fallback={<ListSkeleton rows={3} />}>
				<ChoiceContent choiceId={Number(choiceId)} />
			</Suspense>
		</FeatureGate>
	);
}
