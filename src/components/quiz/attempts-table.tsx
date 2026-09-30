import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Quiz, QuizAttempt, QuizReviewOptions } from "@/types/quiz";
import { formatDateTime, formatMark, scaledGrade } from "./quiz-format";

const STATE_LABEL = { inprogress: "In progress", overdue: "Overdue", finished: "Finished", abandoned: "Never submitted" } as const;

interface AttemptsTableProps {
	quiz: Quiz;
	attempts: QuizAttempt[];
	options: QuizReviewOptions | null;
	courseId: number;
}

/** The user's attempts with marks and grades (per the review options) and review links. */
export function AttemptsTable({ quiz, attempts, options, courseId }: AttemptsTableProps) {
	const showMarks = options?.marks ?? false;
	return (
		<div className="overflow-x-auto rounded-xl border bg-card">
			<table className="w-full text-sm">
				<thead className="border-b text-left text-xs text-muted-foreground">
					<tr>
						<th className="px-4 py-2 font-medium">Attempt</th>
						<th className="px-4 py-2 font-medium">State</th>
						{showMarks && <th className="px-4 py-2 font-medium">Marks</th>}
						{showMarks && <th className="px-4 py-2 font-medium">Grade</th>}
						<th className="px-4 py-2 font-medium">Review</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{attempts.map((a) => {
						const done = a.state === "finished" && a.sumGrades !== undefined;
						return (
							<tr key={a.id}>
								<td className="px-4 py-2 tabular-nums">{a.number}</td>
								<td className="px-4 py-2">
									<Badge variant="secondary">{STATE_LABEL[a.state]}</Badge>
									<p className="mt-1 text-xs text-muted-foreground">
										Started {formatDateTime(a.timeStart)}
										{a.timeFinish && <> · Submitted {formatDateTime(a.timeFinish)}</>}
									</p>
								</td>
								{showMarks && <td className="px-4 py-2 tabular-nums">{done ? `${formatMark(a.sumGrades ?? 0, quiz.decimalPoints)} / ${formatMark(quiz.sumGrades, quiz.decimalPoints)}` : "-"}</td>}
								{showMarks && <td className="px-4 py-2 tabular-nums">{done ? `${formatMark(scaledGrade(a.sumGrades ?? 0, quiz), quiz.decimalPoints)} / ${formatMark(quiz.maxGrade, quiz.decimalPoints)}` : "-"}</td>}
								<td className="px-4 py-2">
									{a.state === "finished" && options?.attempt ? (
										<Link href={`/quizzes/${quiz.id}/review/${a.id}?course=${courseId}`} className="text-primary underline-offset-4 hover:underline">
											Review
										</Link>
									) : (
										<span className="text-muted-foreground">-</span>
									)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
