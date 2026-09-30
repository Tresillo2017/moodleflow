"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichContent } from "@/components/content/rich-content";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { errorMessage } from "@/components/lesson/lesson-player";
import { orderOutline } from "@/lib/moodle/normalize-lesson";
import { toast } from "@/lib/toast";
import type { LessonInfo } from "@/types/lesson";

const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const fmtLimit = (seconds: number) => (seconds >= 3600 ? `${Math.round((seconds / 3600) * 10) / 10} h` : `${Math.round(seconds / 60)} min`);

interface Props {
	lesson: LessonInfo;
	onPlay: (startPageId: number, password?: string) => void;
	onReview: (password?: string) => void;
}

/** Lesson details, password prompt, and start / continue / review. */
export function LessonOverview({ lesson, onPlay, onReview }: Props) {
	const { client } = useMoodleConnection();
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const access = useMoodleQuery(client ? () => client.getLessonAccess(lesson.id) : null, [client, lesson.id]);
	const grade = useMoodleQuery(client && lesson.grade > 0 ? () => client.getLessonGrade(lesson.id) : null, [client, lesson.id, lesson.grade]);

	const info = access.data;
	const resumePageId = info?.lastPageSeen;
	const blocked = info?.blocked ?? [];
	const attempts = info?.attempts ?? 0;
	const exhausted = lesson.maxAttempts > 0 && attempts >= lesson.maxAttempts;
	const outOfAttempts = (exhausted || (!lesson.retake && attempts > 0)) && !resumePageId;
	const needsPassword = lesson.passwordRequired && !password;
	const canReview = lesson.review && attempts > 0;
	const pw = lesson.passwordRequired ? password : undefined;

	async function start() {
		if (!client) return;
		setBusy(true);
		try {
			const notices = await client.launchLesson(lesson.id, { password: pw });
			for (const n of notices) toast.info(n.replace(/<[^>]*>/g, ""));
			const firstPageId = resumePageId ?? info?.firstPageId ?? orderOutline(await client.getLessonOutline(lesson.id, { password: pw }))[0]?.id;
			if (!firstPageId) throw new Error("This lesson has no pages.");
			onPlay(firstPageId, pw);
		} catch (e) {
			toast.error("Couldn't start the lesson", { description: errorMessage(e) });
		} finally {
			setBusy(false);
		}
	}

	async function review() {
		if (!client) return;
		setBusy(true);
		try {
			await client.launchLesson(lesson.id, { password: pw, review: true });
			onReview(pw);
		} catch (e) {
			toast.error("Couldn't open the review", { description: errorMessage(e) });
		} finally {
			setBusy(false);
		}
	}

	const facts = [
		lesson.available && `Opens ${fmtDate(lesson.available)}`,
		lesson.deadline && `Closes ${fmtDate(lesson.deadline)}`,
		lesson.timeLimit > 0 && `Time limit ${fmtLimit(lesson.timeLimit)}`,
		lesson.maxAttempts > 0 && `${attempts} of ${lesson.maxAttempts} attempts used`,
		lesson.practice && "Practice lesson (not graded)",
		lesson.grade > 0 && grade.data?.grade != null && `Your grade: ${grade.data.formatted ?? grade.data.grade} / ${lesson.grade}`,
	].filter(Boolean) as string[];

	return (
		<div className="flex flex-col gap-4">
			{lesson.intro && <RichContent html={lesson.intro} className="rounded-xl border bg-card p-4" />}
			{facts.length > 0 && (
				<ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
					{facts.map((f) => (
						<li key={f}>{f}</li>
					))}
				</ul>
			)}
			{blocked.map((b) => (
				<Alert key={b} variant="destructive">
					<AlertDescription>
						<RichContent html={b} />
					</AlertDescription>
				</Alert>
			))}
			{lesson.passwordRequired && (
				<Input type="password" aria-label="Lesson password" placeholder="Lesson password" autoComplete="off" className="max-w-xs" value={password} onChange={(e) => setPassword(e.target.value)} />
			)}
			<div className="flex flex-wrap gap-2">
				<Button disabled={busy || needsPassword || blocked.length > 0 || outOfAttempts} onClick={() => void start()}>
					{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
					{resumePageId ? "Continue lesson" : attempts > 0 ? "Retake lesson" : "Start lesson"}
				</Button>
				{canReview && (
					<Button variant="outline" disabled={busy || needsPassword} onClick={() => void review()}>
						Review last attempt
					</Button>
				)}
			</div>
			{outOfAttempts && <p className="text-sm text-muted-foreground">{exhausted ? "You've used all the attempts for this lesson." : "Retakes aren't allowed for this lesson."}</p>}
		</div>
	);
}
