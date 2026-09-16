"use client";

import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GraduationCap } from "lucide-react";

export default function GradesPage() {
	const { client } = useMoodleConnection();
	const grades = useMoodleQuery(client ? () => client.getGrades() : null, [client]);

	return (
		<div className="flex flex-col gap-6">
			<h1 className="text-2xl font-semibold tracking-tight">Grades</h1>

			{grades.loading && <ListSkeleton rows={4} />}
			{grades.error && <ErrorState error={grades.error} />}
			{grades.data && grades.data.length === 0 && (
				<EmptyState icon={GraduationCap} title="No grades yet" />
			)}

			{grades.data?.map((course) => (
				<div key={course.courseId} className="flex flex-col gap-2">
					<h2 className="text-sm font-medium">{course.courseName}</h2>
					<div className="rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Item</TableHead>
									<TableHead className="text-right">Grade</TableHead>
									<TableHead className="text-right">Letter</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{course.items.map((item) => (
									<TableRow key={item.id}>
										<TableCell>{item.itemName}</TableCell>
										<TableCell className="text-right tabular-nums">
											{item.grade !== undefined ? `${item.grade}/${item.maxGrade ?? "—"}` : "—"}
										</TableCell>
										<TableCell className="text-right">{item.letterGrade ?? "—"}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			))}
		</div>
	);
}
