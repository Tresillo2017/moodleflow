import type { QuizCorrectness, QuizGradeMethod, QuizQuestionState } from "@/types/quiz";

export const GRADE_METHOD_LABEL: Record<QuizGradeMethod, string> = {
	highest: "Highest grade",
	average: "Average grade",
	first: "First attempt",
	last: "Last attempt",
};

/** "30 mins", "1 hour 30 mins". */
export function formatDuration(totalSeconds: number): string {
	const minutes = Math.round(totalSeconds / 60);
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	const parts = [h && `${h} ${h === 1 ? "hour" : "hours"}`, (m || !h) && `${m} ${m === 1 ? "min" : "mins"}`];
	return parts.filter(Boolean).join(" ");
}

/** Countdown text: "4:05" or "1:02:03". */
export function formatClock(totalSeconds: number): string {
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export const formatDateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export const formatMark = (value: number, decimals: number) => value.toFixed(decimals);

/** An attempt's grade on the quiz's grade scale (Moodle scales marks by maxGrade / sumGrades). */
export const scaledGrade = (sumGrades: number, quiz: { sumGrades: number; maxGrade: number }) => (quiz.sumGrades > 0 ? (sumGrades / quiz.sumGrades) * quiz.maxGrade : 0);

export const CORRECTNESS_STYLE: Record<QuizCorrectness, string> = {
	correct: "border-success/50 bg-success/10",
	partial: "border-warning/50 bg-warning/10",
	incorrect: "border-danger/50 bg-danger/10",
};

export const STATE_LABEL: Partial<Record<QuizQuestionState, string>> = {
	correct: "Correct",
	partial: "Partially correct",
	incorrect: "Incorrect",
	needsgrading: "Requires grading",
	gaveup: "Not answered",
};

/** Moodle links for the "Open in Moodle" fallback. */
export const moodleQuizUrls = (siteUrl: string, cmid: number, attemptId?: number) => {
	const base = siteUrl.replace(/\/$/, "");
	return {
		quiz: `${base}/mod/quiz/view.php?id=${cmid}`,
		attempt: attemptId ? `${base}/mod/quiz/attempt.php?attempt=${attemptId}&cmid=${cmid}` : undefined,
		review: attemptId ? `${base}/mod/quiz/review.php?attempt=${attemptId}&cmid=${cmid}` : undefined,
	};
};
