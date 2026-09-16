"use client";

import Link from "next/link";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { StatusBadge } from "@/components/assignments/status-badge";
import { ClipboardCheck } from "lucide-react";

export default function AssignmentsPage() {
	const { client } = useMoodleConnection();
	const assignments = useMoodleQuery(client ? () => client.getAssignments() : null, [client]);
	const sorted = [...(assignments.data ?? [])].sort((a, b) => {
		if (!a.dueDate) return 1;
		if (!b.dueDate) return -1;
		return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
	});

	return (
		<div className="flex flex-col gap-6">
			<h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>

			{assignments.loading && <ListSkeleton rows={5} />}
			{assignments.error && <ErrorState error={assignments.error} />}
			{sorted.length === 0 && !assignments.loading && !assignments.error && (
				<EmptyState icon={ClipboardCheck} title="No assignments" description="Nothing assigned yet." />
			)}
			{sorted.length > 0 && (
				<div className="flex flex-col divide-y rounded-lg border">
					{sorted.map((a) => (
						<Link
							key={a.id}
							href={`/courses/${a.courseId}`}
							className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/40"
						>
							<div className="min-w-0">
								<p className="truncate font-medium">{a.name}</p>
								<p className="truncate text-xs text-muted-foreground">{a.courseName}</p>
							</div>
							<div className="flex items-center gap-2">
								<StatusBadge status={a.status} />
								<DeadlineBadge dueDate={a.dueDate} />
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
