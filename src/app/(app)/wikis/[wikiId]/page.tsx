"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { useWiki } from "@/hooks/use-engage";
import { EngageFrame } from "@/components/engage/engage-frame";
import { WikiView } from "@/components/wiki/wiki-view";
import { FeatureGate, ListSkeleton } from "@/components/ui/state";

function WikiContent({ wikiId }: { wikiId: number }) {
	const courseId = Number(useSearchParams().get("course")) || null;
	const query = useWiki(wikiId, courseId);
	return (
		<EngageFrame query={query} courseId={courseId} fallbackTitle="Wiki">
			{(wiki) => <WikiView wiki={wiki} />}
		</EngageFrame>
	);
}

export default function WikiPage({ params }: { params: Promise<{ wikiId: string }> }) {
	const { wikiId } = use(params);
	return (
		<FeatureGate feature="Wiki" functions={["mod_wiki_get_wikis_by_courses", "mod_wiki_get_subwiki_pages", "mod_wiki_get_page_contents"]}>
			<Suspense fallback={<ListSkeleton rows={3} />}>
				<WikiContent wikiId={Number(wikiId)} />
			</Suspense>
		</FeatureGate>
	);
}
