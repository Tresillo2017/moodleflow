"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ActivityViewer, hasViewer } from "@/components/activities/activity-viewer";
import { ActivityIcon } from "@/components/activities/activity-icon";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { SubmitDialog } from "@/components/assignments/submit-dialog";
import { FileViewer } from "@/components/files/file-viewer";
import { canSubmit, isDone } from "@/lib/moodle/assignment";
import { CourseBanner } from "@/components/courses/course-banner";
import { FileList } from "@/components/files/file-list";
import { fileKind } from "@/lib/file-kind";
import { CourseGrades } from "@/components/grades/course-grades";
import { CourseBlocks } from "@/components/courses/course-blocks";
import { CourseCompletionCard } from "@/components/courses/course-completion";
import { CourseParticipants } from "@/components/courses/course-participants";
import { useUpdatedModules } from "@/hooks/use-updated-modules";
import { CourseOutline, sectionAnchor } from "@/components/courses/course-outline";
import { RichContent } from "@/components/content/rich-content";
import { ArrowLeft, CheckCircle2, ChevronDown, Circle, ExternalLink, FolderOpen, GraduationCap, Lock, MessageSquare, Pin, Star } from "lucide-react";
import { courseHue, formatDistanceToNow } from "@/lib/format";
import { toast } from "@/lib/toast";
import { isHttpUrl } from "@/lib/utils";
import type { MoodleActivity, MoodleAssignment, MoodleSection } from "@/types/moodle";

function ActivityRow({ activity: a, assignment, updated }: { activity: MoodleActivity; assignment?: MoodleAssignment; updated?: boolean }) {
	const { client, refresh } = useMoodleConnection();
	const logView = () => void client?.logActivityView(a);
	const submittable = assignment ? canSubmit(assignment) : false;
	// Moodle "text and media" blocks carry their content in the description; the name is a truncated copy.
	if (a.type === "label") {
		return <RichContent html={a.description ?? a.name} className="px-4 py-3" />;
	}
	const [viewing, setViewing] = useState(false);
	const [pending, setPending] = useState(false);
	const external = a.type === "url" && isHttpUrl(a.externalUrl) ? a.externalUrl : undefined;
	const href = external ?? a.url;

	if (a.locked) {
		return (
			<div className="flex items-start gap-3 px-4 py-3 text-sm text-muted-foreground">
				<Lock className="mt-0.5 size-4 shrink-0" aria-label="Restricted" />
				<div className="min-w-0 flex-1">
					<p className="truncate">{a.name}</p>
					{a.availabilityInfo && <RichContent html={a.availabilityInfo} className="text-xs [&_p]:my-0.5" />}
				</div>
			</div>
		);
	}

	async function toggleDone() {
		setPending(true);
		try {
			await client?.setActivityCompletion(a.id, !a.completed);
			refresh();
		} catch {
			toast.error("Couldn't update completion", { description: "Moodle rejected the change." });
		} finally {
			setPending(false);
		}
	}

	const statusIcon =
		a.completed === undefined ? (
			<span className="size-4 shrink-0" />
		) : a.completed ? (
			<CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Completed" />
		) : (
			<Circle className="size-4 shrink-0 text-muted-foreground/60" aria-label="Not completed" />
		);
	const content = (
		<>
			<ActivityIcon type={a.type} className="size-4 shrink-0 text-muted-foreground" />
			<span className="flex-1 truncate">{a.name}</span>
			{updated && <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[0.65rem] font-medium text-primary">Updated</span>}
			<DeadlineBadge dueDate={assignment && isDone(assignment) ? undefined : (a.dueDate ?? assignment?.dueDate)} />
			{isHttpUrl(href) && (
				<ExternalLink
					className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
					aria-hidden="true"
				/>
			)}
		</>
	);
	const className = "group flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 text-sm";
	const hover = `${className} transition-colors hover:bg-muted/50`;

	return (
		<div>
			<div className="flex items-center">
				<span className="pl-4">
					{a.manualCompletion && a.completed !== undefined ? (
						<button
							type="button"
							disabled={pending}
							onClick={toggleDone}
							aria-label={a.completed ? "Mark as not done" : "Mark as done"}
							className="rounded-full p-1 -m-1 transition-transform hover:scale-110 focus-visible:outline-2 disabled:opacity-50"
						>
							{statusIcon}
						</button>
					) : (
						statusIcon
					)}
				</span>
				{hasViewer(a) ? (
					<button type="button" className={`${hover} pl-3 text-left`} onClick={() => { setViewing(true); logView(); }}>
						{content}
					</button>
				) : a.type === "assignment" && a.instance !== undefined ? (
					<Link href={`/assignments/${a.instance}`} className={`${hover} pl-3`} onClick={logView}>
						{content}
					</Link>
				) : isHttpUrl(href) ? (
					<a href={href} target="_blank" rel="noopener noreferrer" className={`${hover} pl-3`} onClick={logView}>
						{content}
						<span className="sr-only">({external ? "opens external link" : "opens in Moodle"})</span>
					</a>
				) : (
					<div className={`${className} pl-3`}>{content}</div>
				)}
				{assignment && submittable && (
					<div className="pr-4">
						<SubmitDialog assignment={assignment} onSubmitted={refresh} />
					</div>
				)}
			</div>
			{a.completionDetails && a.completed !== undefined && (
				<p className="px-4 pb-2 pl-11 text-xs text-muted-foreground">To do: {a.completionDetails.join(", ")}</p>
			)}
			{viewing && <ActivityViewer activity={a} onClose={() => setViewing(false)} />}
			{a.description && (
				<RichContent html={a.description} className="line-clamp-3 px-4 pb-3 pl-11 text-xs text-muted-foreground [&_p]:my-1" />
			)}
			{a.files && a.files.length > 0 && !hasViewer(a) && <FileList files={a.files} onOpen={logView} className="pr-4 pb-3 pl-11" />}
		</div>
	);
}

function SectionBlock({ section, assignments, updated }: { section: MoodleSection; assignments: Map<number, MoodleAssignment>; updated: Set<number> }) {
	const tracked = section.activities.filter((a) => a.completed !== undefined);
	const done = tracked.filter((a) => a.completed).length;
	const items = section.activities.filter((a) => a.type !== "label");
	const files = items.reduce((n, a) => n + (a.files?.length ?? 0), 0);
	const now = Date.now();
	const nextDue = items
		.map((a) => {
			const assignment = a.type === "assignment" && a.instance !== undefined ? assignments.get(a.instance) : undefined;
			return assignment && isDone(assignment) ? undefined : (a.dueDate ?? assignment?.dueDate);
		})
		.filter((d): d is string => d !== undefined && new Date(d).getTime() > now)
		.sort()[0];
	const meta = [
		`${items.length} ${items.length === 1 ? "item" : "items"}`,
		files > 0 && `${files} ${files === 1 ? "file" : "files"}`,
		nextDue && `next due ${formatDistanceToNow(nextDue)}`,
	].filter(Boolean);

	return (
		<Collapsible defaultOpen id={sectionAnchor(section.id)} className="scroll-mt-20 overflow-hidden rounded-xl border bg-card">
			<CollapsibleTrigger className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
				<ChevronDown
					className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-0"
					aria-hidden="true"
				/>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-medium">{section.name}</span>
					<span className="block truncate text-xs text-muted-foreground">{meta.join(" · ")}</span>
				</span>
				{tracked.length > 0 && (
					<span className="text-xs text-muted-foreground tabular-nums">
						{done}/{tracked.length} done
					</span>
				)}
			</CollapsibleTrigger>
			<CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
				{section.locked && (
					<div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
						<Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						{section.availabilityInfo ? <RichContent html={section.availabilityInfo} className="text-xs [&_p]:my-0" /> : "This section is restricted."}
					</div>
				)}
				{section.summary && <RichContent html={section.summary} className="border-t px-4 py-3 text-muted-foreground" />}
				<div className="flex flex-col divide-y border-t">
					{section.activities.map((a) => (
						<ActivityRow
							key={a.id}
							activity={a}
							assignment={a.type === "assignment" && a.instance !== undefined ? assignments.get(a.instance) : undefined}
							updated={updated.has(a.id)}
						/>
					))}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

function ForumBlock({ forum }: { forum: MoodleActivity }) {
	const { client, refresh } = useMoodleConnection();
	const discussions = useMoodleQuery(
		client && forum.instance !== undefined ? () => client.getForumDiscussions(forum.instance!) : null,
		[client, forum.instance],
	);

	return (
		<section className="overflow-hidden rounded-xl border bg-card">
			<h2 className="flex items-center gap-2 px-4 py-3 text-xl">
				<MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
				<span className="flex-1 truncate">{forum.name}</span>
				{isHttpUrl(forum.url) && (
					<a
						href={forum.url}
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs font-normal text-muted-foreground hover:text-foreground"
					>
						Open in Moodle<span className="sr-only"> (opens in a new tab)</span>
					</a>
				)}
			</h2>
			<div className="border-t">
				{discussions.loading && <ListSkeleton rows={2} />}
				{discussions.error && <ErrorState error={discussions.error} onRetry={refresh} />}
				{discussions.data?.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">No discussions yet.</p>}
				<ul className="divide-y">
					{discussions.data?.map((d) => (
						<li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
							{d.pinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pinned" />}
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium">{d.subject}</p>
								<p className="truncate text-xs text-muted-foreground">
									{d.author} · {formatDistanceToNow(d.timeModified)}
								</p>
							</div>
							<span className="text-xs text-muted-foreground tabular-nums">
								{d.replies} {d.replies === 1 ? "reply" : "replies"}
							</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}

function CourseDetailContent({ params }: { params: Promise<{ courseId: string }> }) {
	const { courseId } = use(params);
	const id = Number(courseId);
	const { client, refresh } = useMoodleConnection();
	useEffect(() => {
		void client?.logCourseView(id);
	}, [client, id]);

	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const content = useMoodleQuery(client ? () => client.getCourseContents(id) : null, [client, id]);
	const assignmentsQuery = useMoodleQuery(client ? () => client.getAssignments([id]) : null, [client, id]);
	const gradesQuery = useMoodleQuery(client ? () => client.getGrades(id) : null, [client, id]);
	const navOptions = useMoodleQuery(client ? () => client.getCourseNavOptions(id) : null, [client, id]).data;
	// null = the site can't say, so show every tab
	const canOpen = (name: string) => !navOptions || navOptions.includes(name);
	const blocks = useMoodleQuery(client ? () => client.getCourseBlocks(id) : null, [client, id]).data ?? [];
	const updatedModules = useUpdatedModules(id);
	const course = courses.data?.find((c) => c.id === id);
	const sections = content.data?.sections.filter((s) => s.activities.length > 0) ?? [];
	const assignmentsById = useMemo(
		() => new Map((assignmentsQuery.data ?? []).map((a) => [a.id, a])),
		[assignmentsQuery.data],
	);
	const forums = sections.flatMap((s) => s.activities).filter((a) => a.type === "forum" && a.instance !== undefined);
	const courseGrades = gradesQuery.data?.find((g) => g.courseId === id);

	return (
		<div className="flex flex-col gap-6">
			<Link
				href="/courses"
				className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				All courses
			</Link>

			{course ? (
				<div className="flex flex-col gap-4">
					{course.imageUrl && <CourseBanner course={course} className="h-32 rounded-xl sm:h-40" />}
					<PageHeader
						eyebrow={
							<span className="flex items-center gap-2">
								<span
									className="size-2 rounded-full"
									style={{ background: `oklch(0.68 0.15 ${courseHue(course.id)})` }}
									aria-hidden="true"
								/>
								<span className="tracking-wide uppercase">{course.shortName}</span>
								{course.isFavourite && <Star className="size-3 fill-current text-warning" aria-label="Starred" />}
							</span>
						}
						title={course.fullName}
					/>
					<div className="flex max-w-sm items-center gap-3">
						<Progress value={course.progress ?? 0} className="flex-1" />
						<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{course.progress ?? 0}% complete</span>
					</div>
				</div>
			) : courses.loading ? (
				<div className="h-20 w-full animate-pulse rounded-xl bg-muted" />
			) : (
				<PageHeader title="Course" />
			)}

			<Tabs defaultValue="content">
				<TabsList>
					<TabsTrigger value="content">Content</TabsTrigger>
					{canOpen("grades") && <TabsTrigger value="grades">Grades</TabsTrigger>}
					{canOpen("participants") && <TabsTrigger value="participants">Participants</TabsTrigger>}
					{forums.length > 0 && <TabsTrigger value="forums">Forums</TabsTrigger>}
				</TabsList>

				<TabsContent value="content" className={`grid gap-6 pt-2 ${sections.length > 1 || blocks.length > 0 ? "lg:grid-cols-[16rem_minmax(0,1fr)]" : ""}`}>
					{(sections.length > 1 || blocks.length > 0) && (
						<div className="order-2 flex flex-col gap-4 lg:sticky lg:top-20 lg:order-none lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
							{sections.length > 1 && <CourseOutline sections={sections} className="hidden lg:flex" />}
							<CourseBlocks courseId={id} blocks={blocks} />
						</div>
					)}
					<div className="flex min-w-0 flex-col gap-6">
					<CourseCompletionCard courseId={id} />
					{content.loading && <ListSkeleton rows={4} />}
					{content.error && <ErrorState error={content.error} onRetry={refresh} />}
					{content.data && sections.length === 0 && (
						<EmptyState icon={FolderOpen} title="No content yet" description="This course has no published activities." />
					)}

					<div className="flex flex-col gap-3">
						{sections.map((section, i) => (
							<div
								key={section.id}
								className="animate-track-in"
								style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
							>
								<SectionBlock section={section} assignments={assignmentsById} updated={updatedModules} />
							</div>
						))}
					</div>
					</div>
				</TabsContent>

				<TabsContent value="grades" className="flex flex-col gap-3 pt-2">
					{gradesQuery.loading && <ListSkeleton rows={3} />}
					{gradesQuery.error && <ErrorState error={gradesQuery.error} onRetry={refresh} />}
					{gradesQuery.data && !courseGrades && (
						<EmptyState icon={GraduationCap} title="No grades yet" description="Grades for this course show up here." />
					)}
					{courseGrades && <CourseGrades course={courseGrades} />}
				</TabsContent>

				<TabsContent value="participants" className="pt-2">
					<CourseParticipants courseId={id} />
				</TabsContent>

				<TabsContent value="forums" className="flex flex-col gap-3 pt-2">
					{forums.map((f) => (
						<ForumBlock key={f.id} forum={f} />
					))}
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default function CourseDetailPage(props: { params: Promise<{ courseId: string }> }) {
	return (
		<FeatureGate feature="Course content" functions={["core_course_get_contents"]}>
			<CourseDetailContent {...props} />
		</FeatureGate>
	);
}
