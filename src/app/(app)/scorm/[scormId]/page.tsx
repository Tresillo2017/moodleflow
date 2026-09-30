"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { Package } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { EmbedPage } from "@/components/embed/embed-page";
import { ScormActivity } from "@/components/embed/scorm-activity";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { moodleModuleUrl } from "@/lib/moodle/normalize-embed";

function ScormContent({ instance }: { instance: number }) {
	const { client, connection } = useMoodleConnection();
	const courseId = Number(useSearchParams().get("course")) || null;
	const pkg = useMoodleQuery(client && courseId ? () => client.getScorm(courseId, instance) : null, [client, courseId, instance]);
	const p = pkg.data;

	return (
		<EmbedPage courseId={courseId} title={p?.name ?? "SCORM package"} intro={p?.intro} moodleUrl={connection && p ? moodleModuleUrl(connection.siteUrl, "scorm", p.cmid) : undefined}>
			{!courseId && <EmptyState icon={Package} title="SCORM package not found" description="Open this activity from its course page." />}
			{courseId && pkg.loading && <ListSkeleton rows={3} />}
			{pkg.error && <ErrorState error={pkg.error} />}
			{p && <ScormActivity pkg={p} />}
		</EmbedPage>
	);
}

export default function ScormPage({ params }: { params: Promise<{ scormId: string }> }) {
	const { scormId } = use(params);
	return (
		<FeatureGate feature="SCORM packages" functions={["mod_scorm_get_scorms_by_courses", "mod_scorm_get_scorm_scoes", "mod_scorm_insert_scorm_tracks"]}>
			<Suspense fallback={<ListSkeleton rows={3} />}>
				<ScormContent instance={Number(scormId)} />
			</Suspense>
		</FeatureGate>
	);
}
