"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Presentation } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useParticipantNames, useReload, useWorkshop } from "@/hooks/use-workshop";
import { PageHeader } from "@/components/layout/page-header";
import { RichContent } from "@/components/content/rich-content";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { PhasePlanner } from "@/components/workshop/phase-planner";
import { OpenInMoodle } from "@/components/workshop/open-in-moodle";
import { SubmissionPanel } from "@/components/workshop/submission-panel";
import { SubmissionsPanel } from "@/components/workshop/submissions-panel";
import { ReviewPanel } from "@/components/workshop/review-panel";
import { ResultsPanel } from "@/components/workshop/results-panel";
import { formatDayLabel } from "@/lib/format";
import { SUPPORTED_STRATEGIES, type Workshop, type WorkshopPhase } from "@/types/workshop";

type TabId = "submission" | "assess" | "submissions" | "results";

const PHASE_LABEL: Record<WorkshopPhase, string> = {
	setup: "Setup",
	submission: "Submission phase",
	assessment: "Assessment phase",
	evaluation: "Grading evaluation",
	closed: "Closed",
};

function deadlines(w: Workshop): string | undefined {
	const parts = [w.submissionEnd && `Submissions due ${formatDayLabel(w.submissionEnd)}`, w.assessmentEnd && `assessments due ${formatDayLabel(w.assessmentEnd)}`].filter(Boolean);
	return parts.length ? parts.join(" · ") : undefined;
}

function WorkshopBody({ workshop, courseId }: { workshop: Workshop; courseId: number | null }) {
	const { client } = useMoodleConnection();
	const [version, reload] = useReload();
	const nameOf = useParticipantNames(courseId ?? workshop.courseId);
	const [picked, setPicked] = useState<TabId | null>(null);

	const data = useMoodleQuery(
		client
			? async () => {
					const [access, plan, submissions, me] = await Promise.all([
						client.getWorkshopAccess(workshop),
						client.getWorkshopPlan(workshop.id),
						client.getWorkshopSubmissions(workshop.id),
						client.getCurrentUser(),
					]);
					return { access, plan, mine: submissions.find((s) => s.authorId === me.id) ?? null, others: submissions.filter((s) => s.authorId !== me.id) };
				}
			: null,
		[client, workshop, version],
	);

	if (data.loading) return <ListSkeleton rows={3} />;
	if (data.error || !data.data) return data.error ? <ErrorState error={data.error} onRetry={reload} /> : null;
	const { access, plan, mine, others } = data.data;

	const canAssess = (workshop.usePeerAssessment || workshop.useSelfAssessment) && access.canAssess;
	const showResults = workshop.phase === "assessment" || workshop.phase === "evaluation" || workshop.phase === "closed";
	const shown: Record<TabId, boolean> = { submission: access.canSubmit || Boolean(mine), assess: canAssess, submissions: others.length > 0, results: showResults };
	const preferred: TabId[] = workshop.phase === "assessment" ? ["assess", "submission"] : showResults ? ["results", "submission"] : ["submission"];
	const fallback = [...preferred, "submission", "submissions", "results", "assess"].find((t) => shown[t as TabId]) as TabId | undefined ?? "submission";
	const tab = picked ?? fallback;
	const unsupported = !(SUPPORTED_STRATEGIES as readonly string[]).includes(workshop.strategy);

	return (
		<>
			{plan.length > 0 && <PhasePlanner plan={plan} />}
			{workshop.phase === "setup" && <EmptyState icon={Presentation} title="This workshop isn't open yet" description="Your teacher is still setting it up. Check back once the submission phase starts." />}
			{unsupported && canAssess && (
				<div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4 text-sm">
					<p className="flex-1">Assessment forms for the “{workshop.strategy}” grading strategy aren&apos;t supported here. You can assess in Moodle.</p>
					<OpenInMoodle cmid={workshop.cmid} />
				</div>
			)}
			{workshop.phase !== "setup" && (
				<Tabs value={tab} onValueChange={(v) => setPicked(v as TabId)}>
					<TabsList>
						{shown.submission && <TabsTrigger value="submission">Your submission</TabsTrigger>}
						{shown.assess && <TabsTrigger value="assess">Assess peers</TabsTrigger>}
						{shown.submissions && <TabsTrigger value="submissions">Submissions ({others.length})</TabsTrigger>}
						{shown.results && <TabsTrigger value="results">Results</TabsTrigger>}
					</TabsList>
					<TabsContent value="submission" className="pt-4">
						<SubmissionPanel workshop={workshop} access={access} mine={mine} onChanged={reload} />
					</TabsContent>
					<TabsContent value="assess" className="pt-4">
						<ReviewPanel workshop={workshop} access={access} nameOf={nameOf} onChanged={reload} />
					</TabsContent>
					<TabsContent value="submissions" className="pt-4">
						<SubmissionsPanel workshop={workshop} access={access} submissions={others} nameOf={nameOf} />
					</TabsContent>
					<TabsContent value="results" className="pt-4">
						<ResultsPanel workshop={workshop} access={access} mine={mine} nameOf={nameOf} />
					</TabsContent>
				</Tabs>
			)}
			{workshop.conclusion && workshop.phase === "closed" && <RichContent html={workshop.conclusion} className="rounded-xl border bg-card p-4" />}
		</>
	);
}

function WorkshopContent({ workshopId }: { workshopId: number }) {
	const courseId = Number(useSearchParams().get("course")) || null;
	const workshop = useWorkshop(workshopId, courseId);
	const w = workshop.data;

	return (
		<div className="flex flex-col gap-6">
			<Link href={courseId ? `/courses/${courseId}` : "/courses"} className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				Back to course
			</Link>
			{workshop.loading ? (
				<ListSkeleton rows={3} />
			) : workshop.error ? (
				<ErrorState error={workshop.error} />
			) : !w ? (
				<EmptyState icon={Presentation} title="Workshop not found" description="It may have been removed, or you may not have access to it." />
			) : (
				<>
					<PageHeader
						title={w.name}
						eyebrow={<Badge variant="secondary">{PHASE_LABEL[w.phase]}</Badge>}
						description={deadlines(w)}
						actions={<OpenInMoodle cmid={w.cmid} />}
					/>
					{w.intro && <RichContent html={w.intro} className="rounded-xl border bg-card p-4" />}
					<WorkshopBody workshop={w} courseId={courseId} />
				</>
			)}
		</div>
	);
}

export default function WorkshopPage({ params }: { params: Promise<{ workshopId: string }> }) {
	const { workshopId } = use(params);
	return (
		<FeatureGate feature="Workshops" functions={["mod_workshop_get_workshops_by_courses", "mod_workshop_get_user_plan"]}>
			<Suspense fallback={<ListSkeleton rows={4} />}>
				<WorkshopContent workshopId={Number(workshopId)} />
			</Suspense>
		</FeatureGate>
	);
}
