"use client";

import { useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { CourseCard } from "@/components/courses/course-card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, ListSkeleton, FeatureGate } from "@/components/ui/state";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { NotebookText, SearchX } from "lucide-react";
import type { MoodleCourse } from "@/types/moodle";

/** Moodle's own overview groups; `heuristic` is the fallback when the site lacks the classification API. */
const FILTERS = {
	current: { label: "In progress", classification: "inprogress", heuristic: isCurrentCourse },
	future: { label: "Future", classification: "future", heuristic: () => false },
	past: { label: "Past", classification: "past", heuristic: (c: MoodleCourse) => !isCurrentCourse(c) },
	starred: { label: "Starred", classification: "favourites", heuristic: (c: MoodleCourse) => isCurrentCourse(c) && Boolean(c.isFavourite) },
	hidden: { label: "Hidden", classification: "hidden", heuristic: () => false },
	all: { label: "All", classification: "all", heuristic: () => true },
} as const;

type Filter = keyof typeof FILTERS;

function CoursesPageContent() {
	const { client, refresh } = useMoodleConnection();
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const [filter, setFilter] = useState<Filter>("current");
	const [query, setQuery] = useState("");

	// Moodle decides what is in progress, past, starred or hidden; null means it couldn't say, so we guess from course dates.
	const classified = useMoodleQuery(
		client ? () => client.getCourseIdsByClassification(FILTERS[filter].classification).catch(() => null) : null,
		[client, filter, courses.data],
	).data;

	const all = courses.data ?? [];
	const q = query.trim().toLowerCase();
	const inGroup = (c: MoodleCourse) => (classified ? classified.includes(c.id) : FILTERS[filter].heuristic(c));
	const visible = all
		.filter(inGroup)
		.filter((c) => !q || c.fullName.toLowerCase().includes(q) || c.shortName.toLowerCase().includes(q));
	const currentCount = all.filter(isCurrentCourse).length;

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="My Courses"
				description={courses.data ? `${currentCount} in progress · ${all.length} enrolled in total` : undefined}
			/>

			<div className="flex flex-wrap items-center gap-3">
				<Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
					<TabsList>
						{(Object.keys(FILTERS) as Filter[]).map((key) => (
							<TabsTrigger key={key} value={key}>
								{FILTERS[key].label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<SearchInput
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Filter courses"
					aria-label="Filter courses"
					className="w-full sm:ml-auto sm:w-64"
				/>
			</div>

			{courses.loading && <ListSkeleton rows={4} />}
			{courses.error && <ErrorState error={courses.error} onRetry={refresh} />}
			{courses.data && all.length === 0 && (
				<EmptyState icon={NotebookText} title="No courses yet" description="You're not enrolled in any courses." />
			)}
			{courses.data && all.length > 0 && visible.length === 0 && (
				<EmptyState
					icon={SearchX}
					title="No matching courses"
					description={q ? `Nothing matches “${query.trim()}”.` : "Nothing in this view yet."}
				/>
			)}
			{visible.length > 0 && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{visible.map((c, i) => (
						<div
							key={c.id}
							className="animate-track-in"
							style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
						>
							<CourseCard course={c} hidden={filter === "hidden"} />
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export default function CoursesPage() {
	return (
		<FeatureGate feature="Courses" functions={["core_enrol_get_users_courses"]}>
			<CoursesPageContent />
		</FeatureGate>
	);
}
