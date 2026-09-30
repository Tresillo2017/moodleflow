"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { Blocks } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { EmbedPage } from "@/components/embed/embed-page";
import { LtiLaunchButton } from "@/components/embed/lti-launch-button";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { moodleModuleUrl } from "@/lib/moodle/normalize-embed";

const hostOf = (url: string) => {
	try {
		return new URL(url).host;
	} catch {
		return undefined;
	}
};

function LtiContent({ instance }: { instance: number }) {
	const { client, connection } = useMoodleConnection();
	const courseId = Number(useSearchParams().get("course")) || null;
	const tool = useMoodleQuery(client && courseId ? () => client.getLtiTool(courseId, instance) : null, [client, courseId, instance]);
	const t = tool.data;
	const host = t?.toolUrl && hostOf(t.toolUrl);

	return (
		<EmbedPage courseId={courseId} title={t?.name ?? "External tool"} intro={t?.intro} moodleUrl={connection && t ? moodleModuleUrl(connection.siteUrl, "lti", t.cmid) : undefined}>
			{!courseId && <EmptyState icon={Blocks} title="External tool not found" description="Open this activity from its course page." />}
			{courseId && tool.loading && <ListSkeleton rows={2} />}
			{tool.error && <ErrorState error={tool.error} />}
			{t && (
				<section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
					<p className="text-sm text-muted-foreground">
						{host ? `This opens ${host} in a new tab, signed in as you.` : "This opens the tool in a new tab, signed in as you."}
					</p>
					<LtiLaunchButton tool={t} />
				</section>
			)}
		</EmbedPage>
	);
}

export default function LtiPage({ params }: { params: Promise<{ ltiId: string }> }) {
	const { ltiId } = use(params);
	return (
		<FeatureGate feature="External tools" functions={["mod_lti_get_tool_launch_data", "mod_lti_get_ltis_by_courses"]}>
			<Suspense fallback={<ListSkeleton rows={2} />}>
				<LtiContent instance={Number(ltiId)} />
			</Suspense>
		</FeatureGate>
	);
}
