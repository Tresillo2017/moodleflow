"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LinkContextMenu } from "@/components/navigation/link-context-menu";
import { ContextMenuItem } from "@/components/ui/context-menu";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { StatusBadge } from "@/components/assignments/status-badge";
import { SubmitDialog } from "@/components/assignments/submit-dialog";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { canSubmit, isDone } from "@/lib/moodle/assignment";
import { useAssignments } from "@/hooks/use-assignments";
import { courseHue } from "@/lib/format";
import { ClipboardCheck, GraduationCap, SearchX } from "lucide-react";
import type { MoodleAssignment } from "@/types/moodle";

const WEEK_MS = 7 * 86_400_000;

const BUCKETS = {
	overdue: "Overdue",
	week: "Due this week",
	later: "Later",
	none: "No due date",
	done: "Completed",
} as const;

type Bucket = keyof typeof BUCKETS;

const VIEWS = {
	todo: { label: "To do", buckets: ["overdue", "week", "later", "none"] },
	done: { label: "Completed", buckets: ["done"] },
	all: { label: "All", buckets: ["overdue", "week", "later", "none", "done"] },
} as const satisfies Record<string, { label: string; buckets: readonly Bucket[] }>;

type View = keyof typeof VIEWS;

function bucketOf(a: MoodleAssignment, now: number): Bucket {
	if (isDone(a)) return "done";
	if (!a.dueDate) return "none";
	const due = new Date(a.dueDate).getTime();
	if (due < now) return "overdue";
	return due - now <= WEEK_MS ? "week" : "later";
}

function byDue(a: MoodleAssignment, b: MoodleAssignment) {
	if (!a.dueDate) return 1;
	if (!b.dueDate) return -1;
	return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

function AssignmentRow({ assignment: a, onSubmitted }: { assignment: MoodleAssignment; onSubmitted: () => void }) {
	const router = useRouter();
	return (
		// Stretched-link row: the title link covers the row, the submit button sits above it.
		<LinkContextMenu
			href={`/assignments/${a.id}`}
			render={
				<div className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50 has-[a:focus-visible]:bg-muted/50" />
			}
			extra={
				<ContextMenuItem onClick={() => router.push(`/courses/${a.courseId}`)}>
					<GraduationCap /> Go to course
				</ContextMenuItem>
			}
		>
			<div className="flex min-w-0 items-center gap-3">
				<span
					className="h-8 w-1 shrink-0 rounded-full"
					style={{ background: `oklch(0.68 0.15 ${courseHue(a.courseId)})` }}
					aria-hidden="true"
				/>
				<div className="min-w-0">
					<Link
						href={`/assignments/${a.id}`}
						className="block truncate font-medium after:absolute after:inset-0 focus-visible:outline-none"
					>
						{a.name}
					</Link>
					<p className="truncate text-xs text-muted-foreground">{a.courseName}</p>
				</div>
			</div>
			<div className="flex items-center gap-2 pl-4">
				{a.grade !== undefined && (
					<span className="text-xs font-medium tabular-nums">
						{a.grade}/{a.maxGrade ?? "—"}
					</span>
				)}
				{/* the deadline badge already says "Overdue by …" */}
				{a.status !== "overdue" && <StatusBadge status={a.status} />}
				{!isDone(a) && <DeadlineBadge dueDate={a.dueDate} />}
				{canSubmit(a) && (
					<div className="relative z-10">
						<SubmitDialog assignment={a} onSubmitted={onSubmitted} />
					</div>
				)}
			</div>
		</LinkContextMenu>
	);
}

export default function AssignmentsPage() {
	const { client, refresh } = useMoodleConnection();
	const assignments = useAssignments();
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const [view, setView] = useState<View>("todo");
	const [query, setQuery] = useState("");

	const now = Date.now();
	const currentCourseIds = new Set(courses.data?.filter(isCurrentCourse).map((c) => c.id));
	const current = (assignments.data ?? []).filter((a) => currentCourseIds.has(a.courseId));
	const q = query.trim().toLowerCase();
	const matching = current.filter(
		(a) => !q || a.name.toLowerCase().includes(q) || a.courseName.toLowerCase().includes(q),
	);

	const groups = VIEWS[view].buckets
		.map((bucket) => ({
			bucket,
			items: matching.filter((a) => bucketOf(a, now) === bucket).sort(byDue),
		}))
		.filter((g) => g.items.length > 0);

	const todoCount = current.filter((a) => bucketOf(a, now) !== "done").length;
	const overdueCount = current.filter((a) => bucketOf(a, now) === "overdue").length;
	const loaded = Boolean(assignments.data && courses.data);

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Assignments"
				description={
					loaded ? `${todoCount} to do${overdueCount ? ` · ${overdueCount} overdue` : ""}` : undefined
				}
			/>

			<div className="flex flex-wrap items-center gap-3">
				<Tabs value={view} onValueChange={(v) => setView(v as View)}>
					<TabsList>
						{(Object.keys(VIEWS) as View[]).map((key) => (
							<TabsTrigger key={key} value={key}>
								{VIEWS[key].label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<SearchInput
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Filter by name or course"
					aria-label="Filter assignments"
					className="w-full sm:ml-auto sm:w-64"
				/>
			</div>

			{assignments.loading && <ListSkeleton rows={5} />}
			{assignments.error && <ErrorState error={assignments.error} onRetry={refresh} />}
			{loaded && groups.length === 0 && (
				q ? (
					<EmptyState icon={SearchX} title="No matching assignments" description={`Nothing matches “${query.trim()}”.`} />
				) : (
					<EmptyState
						icon={ClipboardCheck}
						title={view === "done" ? "Nothing completed yet" : "All caught up"}
						description={view === "done" ? "Submitted and graded work shows up here." : "No open assignments right now."}
					/>
				)
			)}

			{groups.map(({ bucket, items }, i) => (
				<section
					key={bucket}
					className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 fill-mode-backwards duration-300 ease-out"
					style={{ animationDelay: `${i * 50}ms` }}
				>
					<h2
						className={
							bucket === "overdue"
								? "flex items-center gap-2 text-sm font-medium text-danger"
								: "flex items-center gap-2 text-sm font-medium text-muted-foreground"
						}
					>
						{BUCKETS[bucket]}
						<span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">{items.length}</span>
					</h2>
					<div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
						{items.map((a) => (
							<AssignmentRow key={a.id} assignment={a} onSubmitted={refresh} />
						))}
					</div>
				</section>
			))}
		</div>
	);
}
