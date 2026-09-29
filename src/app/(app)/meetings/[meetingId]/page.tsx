"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, Play, Video } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useActivity } from "@/hooks/use-activity";
import { useSupports } from "@/hooks/use-supports";
import { PageHeader } from "@/components/layout/page-header";
import { RichContent } from "@/components/content/rich-content";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { toast } from "@/lib/toast";

const dateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function MeetingContent({ instance }: { instance: number }) {
	const { client, refresh } = useMoodleConnection();
	const courseId = Number(useSearchParams().get("course")) || null;
	const { activity, loading: activityLoading } = useActivity(courseId, "bigbluebuttonbn", instance);
	const cmid = activity?.id;
	const info = useMoodleQuery(client && cmid ? () => client.getMeetingInfo(cmid, instance) : null, [client, cmid, instance]);
	const canRecord = useSupports("mod_bigbluebuttonbn_get_recordings");
	const recordings = useMoodleQuery(client && canRecord ? () => client.getMeetingRecordings(instance).catch(() => []) : null, [client, instance, canRecord]);
	const [joining, setJoining] = useState(false);

	async function join() {
		if (!client || !cmid) return;
		setJoining(true);
		try {
			const url = await client.getMeetingJoinUrl(cmid);
			window.open(url, "_blank", "noopener,noreferrer");
			refresh();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't join the meeting.");
		} finally {
			setJoining(false);
		}
	}

	const m = info.data;
	return (
		<div className="flex flex-col gap-6">
			<Link href={courseId ? `/courses/${courseId}` : "/courses"} className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				Back to course
			</Link>
			<PageHeader title={activity?.name ?? "Meeting"} />
			{activity?.description && <RichContent html={activity.description} className="rounded-xl border bg-card p-4" />}
			{(activityLoading || info.loading) && <ListSkeleton rows={2} />}
			{!activityLoading && !cmid && <EmptyState icon={Video} title="Meeting not found" description="Open this meeting from its course page." />}
			{info.error && <ErrorState error={info.error} onRetry={refresh} />}
			{m && (
				<section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
					<p className="flex items-center gap-2 text-sm">
						<span className={`size-2 rounded-full ${m.running ? "bg-success" : "bg-muted-foreground/50"}`} aria-hidden="true" />
						{m.running ? `In progress · ${m.participantCount} ${m.participantCount === 1 ? "participant" : "participants"}` : "Not started yet"}
					</p>
					{m.openingTime && <p className="text-xs text-muted-foreground">Opens {dateTime(m.openingTime)}</p>}
					{m.closingTime && <p className="text-xs text-muted-foreground">Closes {dateTime(m.closingTime)}</p>}
					{!m.canJoin && m.message && <p className="text-sm text-muted-foreground">{m.message}</p>}
					<Button className="w-fit" onClick={join} disabled={!m.canJoin || joining}>
						{joining ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Video aria-hidden="true" />}
						{m.running ? "Join meeting" : "Start meeting"}
					</Button>
				</section>
			)}
			{canRecord && recordings.data && recordings.data.length > 0 && (
				<section className="flex flex-col gap-3">
					<h2 className="text-2xl">Recordings</h2>
					<ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
						{recordings.data.map((r) => (
							<li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
								<Play className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
								<span className="min-w-0 flex-1">
									<span className="block truncate font-medium">{r.name}</span>
									{r.date && <span className="text-xs text-muted-foreground">{dateTime(r.date)}</span>}
								</span>
								{r.playbacks.map((p) => (
									<Button key={p.type + p.url} variant="outline" size="sm" nativeButton={false} render={<a href={p.url} target="_blank" rel="noopener noreferrer" />}>
										{p.type}
										<ExternalLink aria-hidden="true" />
									</Button>
								))}
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}

export default function MeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
	const { meetingId } = use(params);
	return (
		<FeatureGate feature="BigBlueButton meetings" functions={["mod_bigbluebuttonbn_get_join_url"]}>
			<Suspense fallback={<ListSkeleton rows={2} />}>
				<MeetingContent instance={Number(meetingId)} />
			</Suspense>
		</FeatureGate>
	);
}
