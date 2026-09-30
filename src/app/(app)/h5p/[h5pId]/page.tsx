"use client";

import { Suspense, use, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Puzzle } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { EmbedPage } from "@/components/embed/embed-page";
import { H5pAttempts } from "@/components/embed/h5p-attempts";
import { H5pPlayer } from "@/components/embed/h5p-player";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { moodleModuleUrl } from "@/lib/moodle/normalize-embed";

function H5pContent({ instance }: { instance: number }) {
	const { client, connection } = useMoodleConnection();
	const courseId = Number(useSearchParams().get("course")) || null;
	const [reloads, setReloads] = useState(0);
	const activity = useMoodleQuery(client && courseId ? () => client.getH5pActivity(courseId, instance) : null, [client, courseId, instance]);
	const canListAttempts = activity.data?.trackingEnabled;
	const attempts = useMoodleQuery(client && canListAttempts ? () => client.getH5pAttempts(instance).catch(() => []) : null, [client, instance, canListAttempts, reloads]);
	const a = activity.data;

	return (
		<EmbedPage courseId={courseId} title={a?.name ?? "H5P"} intro={a?.intro} moodleUrl={connection && a ? moodleModuleUrl(connection.siteUrl, "h5pactivity", a.cmid) : undefined}>
			{!courseId && <EmptyState icon={Puzzle} title="H5P activity not found" description="Open this activity from its course page." />}
			{courseId && activity.loading && <ListSkeleton rows={2} />}
			{activity.error && <ErrorState error={activity.error} />}
			{a && <H5pPlayer activity={a} onStatement={() => setReloads((n) => n + 1)} />}
			{a && attempts.data && <H5pAttempts attempts={attempts.data} />}
		</EmbedPage>
	);
}

export default function H5pPage({ params }: { params: Promise<{ h5pId: string }> }) {
	const { h5pId } = use(params);
	return (
		<FeatureGate feature="H5P activities" functions={["mod_h5pactivity_get_h5pactivities_by_courses", "core_h5p_get_trusted_h5p_file"]}>
			<Suspense fallback={<ListSkeleton rows={2} />}>
				<H5pContent instance={Number(h5pId)} />
			</Suspense>
		</FeatureGate>
	);
}
