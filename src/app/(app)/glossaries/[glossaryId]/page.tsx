"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { useGlossary } from "@/hooks/use-engage";
import { EngageFrame } from "@/components/engage/engage-frame";
import { GlossaryView } from "@/components/glossary/glossary-view";
import { FeatureGate, ListSkeleton } from "@/components/ui/state";

function GlossaryContent({ glossaryId }: { glossaryId: number }) {
	const courseId = Number(useSearchParams().get("course")) || null;
	const query = useGlossary(glossaryId, courseId);
	return (
		<EngageFrame query={query} courseId={courseId} fallbackTitle="Glossary">
			{(glossary) => <GlossaryView glossary={glossary} />}
		</EngageFrame>
	);
}

export default function GlossaryPage({ params }: { params: Promise<{ glossaryId: string }> }) {
	const { glossaryId } = use(params);
	return (
		<FeatureGate feature="Glossary" functions={["mod_glossary_get_glossaries_by_courses", "mod_glossary_get_entries_by_letter"]}>
			<Suspense fallback={<ListSkeleton rows={3} />}>
				<GlossaryContent glossaryId={Number(glossaryId)} />
			</Suspense>
		</FeatureGate>
	);
}
