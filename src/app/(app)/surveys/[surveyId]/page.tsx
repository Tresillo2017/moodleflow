"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { useSurvey } from "@/hooks/use-engage";
import { EngageFrame } from "@/components/engage/engage-frame";
import { SurveyView } from "@/components/engage/survey-view";
import { FeatureGate, ListSkeleton } from "@/components/ui/state";

function SurveyContent({ surveyId }: { surveyId: number }) {
	const courseId = Number(useSearchParams().get("course")) || null;
	const query = useSurvey(surveyId, courseId);
	return (
		<EngageFrame query={query} courseId={courseId} fallbackTitle="Survey">
			{(survey) => <SurveyView survey={survey} />}
		</EngageFrame>
	);
}

export default function SurveyPage({ params }: { params: Promise<{ surveyId: string }> }) {
	const { surveyId } = use(params);
	return (
		<FeatureGate feature="Survey" functions={["mod_survey_get_questions", "mod_survey_submit_answers"]}>
			<Suspense fallback={<ListSkeleton rows={3} />}>
				<SurveyContent surveyId={Number(surveyId)} />
			</Suspense>
		</FeatureGate>
	);
}
