"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ActivityIcon } from "@/components/activities/activity-icon";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { SubmitDialog } from "@/components/assignments/submit-dialog";
import { FileViewer } from "@/components/files/file-viewer";
import { canSubmit } from "@/lib/moodle/assignment";
import { CourseBanner } from "@/components/courses/course-banner";
import { FileList } from "@/components/files/file-list";
import { fileKind } from "@/lib/file-kind";
import { CourseGrades } from "@/components/grades/course-grades";
import { ArrowLeft, CheckCircle2, ChevronDown, Circle, ExternalLink, FolderOpen, GraduationCap, MessageSquare, Pin, Star } from "lucide-react";
import { courseHue, formatDistanceToNow } from "@/lib/format";
import { isHttpUrl } from "@/lib/utils";
import type { MoodleActivity, MoodleAssignment, MoodleSection } from "@/types/moodle";

function ActivityRow({ activity: a, assignment }: { activity: MoodleActivity; assignment?: MoodleAssignment }) {
	const { refresh } = useMoodleConnection();
	const submittable = assignment ? canSubmit(assignment) : false;
	const content = (
		<>
			{a.completed === undefined ? (
				<span className="size-4 shrink-0" />
			) : a.completed ? (
				<CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Completed" />
			) : (
				<Circle className="size-4 shrink-0 text-muted-foreground/60" aria-label="Not completed" />
			)}
			<ActivityIcon type={a.type} className="size-4 shrink-0 text-muted-foreground" />
			<span className="flex-1 truncate">{a.name}</span>
			<DeadlineBadge dueDate={a.dueDate ?? assignment?.dueDate} />
			{isHttpUrl(a.url) && (
				<ExternalLink
					className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
					aria-hidden="true"
				/>
			)}
		</>
	);
	const className = "group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-sm";

	return (
		<div>
			<div className="flex items-center">
				{a.type === "assignment" && a.instance !== undefined ? (
					<Link href={`/assignments/${a.instance}`} className={`${className} transition-colors hover:bg-muted/50`}>
						{content}
					</Link>
				) : isHttpUrl(a.url) ? (
					<a href={a.url} target="_blank" rel="noopener noreferrer" className={`${className} transition-colors hover:bg-muted/50`}>
						{content}
						<span className="sr-only">(opens in Moodle)</span>
					</a>
				) : (
					<div className={className}>{content}</div>
				)}
				{assignment && submittable && (
					<div className="pr-4">
						<SubmitDialog assignment={assignment} onSubmitted={refresh} />
					</div>
				)}
			</div>
			{a.files && a.files.length > 0 && <FileList files={a.files} className="pr-4 pb-3 pl-11" />}
		</div>
	);
}

function SectionBlock({ section, assignments }: { section: MoodleSection; assignments: Map<number, MoodleAssignment> }) {
	const tracked = section.activities.filter((a) => a.completed !== undefined);
	const done = tracked.filter((a) => a.completed).length;

	return (
		<Collapsible defaultOpen className="overflow-hidden rounded-xl border bg-card">
			<CollapsibleTrigger className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
				<ChevronDown
					className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-0"
					aria-hidden="true"
				/>
				<span className="flex-1 truncate text-sm font-medium">{section.name}</span>
				{tracked.length > 0 && (
					<span className="text-xs text-muted-foreground tabular-nums">
						{done}/{tracked.length} done
					</span>
				)}
			</CollapsibleTrigger>
			<CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
				<div className="flex flex-col divide-y border-t">
					{section.activities.map((a) => (
						<ActivityRow
							key={a.id}
							activity={a}
							assignment={a.type === "assignment" && a.instance !== undefined ? assignments.get(a.instance) : undefined}
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
			<h2 className="flex items-center gap-2 px-4 py-3 text-sm font-medium">
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

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
	const { courseId } = use(params);
	const id = Number(courseId);
	const { client, refresh } = useMoodleConnection();

	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const content = useMoodleQuery(client ? () => client.getCourseContents(id) : null, [client, id]);
	const assignmentsQuery = useMoodleQuery(client ? () => client.getAssignments([id]) : null, [client, id]);
	const gradesQuery = useMoodleQuery(client ? () => client.getGrades(id) : null, [client, id]);
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
					<TabsTrigger value="grades">Grades</TabsTrigger>
					{forums.length > 0 && <TabsTrigger value="forums">Forums</TabsTrigger>}
				</TabsList>

				<TabsContent value="content" className="flex flex-col gap-6 pt-2">
					{content.loading && <ListSkeleton rows={4} />}
					{content.error && <ErrorState error={content.error} onRetry={refresh} />}
					{content.data && sections.length === 0 && (
						<EmptyState icon={FolderOpen} title="No content yet" description="This course has no published activities." />
					)}

					<div className="flex flex-col gap-3">
						{sections.map((section, i) => (
							<div
								key={section.id}
								className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 fill-mode-backwards duration-300 ease-out"
								style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
							>
								<SectionBlock section={section} assignments={assignmentsById} />
							</div>
						))}
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

				<TabsContent value="forums" className="flex flex-col gap-3 pt-2">
					{forums.map((f) => (
						<ForumBlock key={f.id} forum={f} />
					))}
				</TabsContent>
			</Tabs>
		</div>
	);
}
