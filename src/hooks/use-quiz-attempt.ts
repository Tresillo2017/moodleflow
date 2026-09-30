"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { isQuestionAnswered, quizAnswerData } from "@/lib/moodle/normalize-quiz";
import { toast } from "@/lib/toast";
import { MoodleError } from "@/types/moodle";
import type { QuizAttemptPage, QuizNavItem, QuizQuestion } from "@/types/quiz";

export type QuizView = { kind: "page"; page: number } | { kind: "summary" };
export type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 4000;

const asError = (e: unknown) => (e instanceof MoodleError ? e : new MoodleError("unknown_error", "Something went wrong with the quiz."));
const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/**
 * Drives one in-progress attempt: paging, edits, debounced autosave, the countdown, flags and submission.
 * `onFinished` fires once the attempt is submitted (or was already finished).
 */
export function useQuizAttempt(quizId: number, attemptId: number, onFinished: () => void) {
	const { client } = useMoodleConnection();
	const [view, setView] = useState<QuizView | null>(null);
	const [pageData, setPageData] = useState<QuizAttemptPage | null>(null);
	const [nav, setNav] = useState<QuizNavItem[]>([]);
	const [edits, setEdits] = useState<Record<string, string>>({});
	const [flags, setFlags] = useState<Record<number, boolean>>({});
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<MoodleError | null>(null);
	const [endTime, setEndTime] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const [reloads, setReloads] = useState(0);

	const dirty = useRef(false);
	const expired = useRef(false);
	const latest = useRef({ pageData, edits, view, onFinished });
	useEffect(() => {
		latest.current = { pageData, edits, view, onFinished };
	});

	const loadPage = useCallback(
		async (page: number) => {
			if (!client) return;
			const [data, summary] = await Promise.all([client.getQuizAttemptPage(attemptId, page), client.getQuizAttemptSummary(attemptId)]);
			dirty.current = false;
			setPageData(data);
			setNav(summary);
			setEdits({});
			setFlags({});
			setSaveStatus("idle");
			setView({ kind: "page", page });
		},
		[client, attemptId],
	);

	useEffect(() => {
		if (!client) return;
		let cancelled = false;
		(async () => {
			try {
				const [access, attempts] = await Promise.all([client.getQuizAttemptAccess(quizId, attemptId), client.getQuizAttempts(quizId)]);
				const attempt = attempts.find((a) => a.id === attemptId);
				if (cancelled) return;
				if (access.isFinished || (attempt?.state === "finished" || attempt?.state === "abandoned")) return latest.current.onFinished();
				setEndTime(access.endTime ? Date.parse(access.endTime) : null);
				await loadPage(attempt?.currentPage ?? 0);
				if (!cancelled) setError(null);
			} catch (e) {
				if (!cancelled) setError(asError(e));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [client, quizId, attemptId, loadPage, reloads]);

	const setAnswer = useCallback((name: string, value: string) => {
		dirty.current = true;
		setEdits((e) => ({ ...e, [name]: value }));
	}, []);

	const save = useCallback(async () => {
		const { pageData: data, edits: current } = latest.current;
		if (!client || !data || !dirty.current) return;
		dirty.current = false;
		setSaveStatus("saving");
		try {
			await client.saveQuizAttempt(attemptId, quizAnswerData(data.questions, current));
			setSaveStatus("saved");
		} catch {
			dirty.current = true;
			setSaveStatus("error");
		}
	}, [client, attemptId]);

	useEffect(() => {
		if (!dirty.current) return;
		const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
		return () => clearTimeout(timer);
	}, [edits, save]);

	// navigating away inside the app: flush what's pending
	useEffect(() => () => void save(), [save]);

	// leaving with unsaved answers would lose them
	useEffect(() => {
		const warn = (e: BeforeUnloadEvent) => dirty.current && e.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, []);

	/** Commits the visible page's answers (Moodle turns autosaves into a real step only here). */
	const commitPage = useCallback(async () => {
		const { pageData: data, edits: current, view: v } = latest.current;
		if (!client || !data || v?.kind !== "page" || Object.keys(current).length === 0) return;
		await client.processQuizAttempt(attemptId, quizAnswerData(data.questions, current));
		dirty.current = false;
	}, [client, attemptId]);

	const navigate = useCallback(
		async (target: QuizView) => {
			if (!client || busy) return;
			setBusy(true);
			try {
				await commitPage();
				if (target.kind === "page") await loadPage(target.page);
				else {
					setNav(await client.getQuizAttemptSummary(attemptId));
					setPageData(null);
					setEdits({});
					setView(target);
				}
			} catch (e) {
				toast.error(messageOf(e, "Couldn't save your answers. Try again."));
			} finally {
				setBusy(false);
			}
		},
		[client, busy, attemptId, commitPage, loadPage],
	);

	const finish = useCallback(
		async (timeUp = false) => {
			if (!client) return;
			setBusy(true);
			try {
				const { pageData: data, edits: current, view: v } = latest.current;
				const answers = data && v?.kind === "page" ? quizAnswerData(data.questions, current) : {};
				await client.processQuizAttempt(attemptId, answers, { finish: true, timeUp });
				dirty.current = false;
				latest.current.onFinished();
			} catch (e) {
				toast.error(messageOf(e, "Couldn't submit the quiz. Try again."));
				setBusy(false);
				expired.current = false;
			}
		},
		[client, attemptId],
	);

	const toggleFlag = useCallback(
		async (q: QuizQuestion) => {
			if (!client || !q.flag) return;
			const next = !(flags[q.slot] ?? q.flagged);
			setFlags((f) => ({ ...f, [q.slot]: next }));
			try {
				await client.setQuizQuestionFlag(q.flag, next);
			} catch {
				setFlags((f) => ({ ...f, [q.slot]: !next }));
				toast.error("Couldn't flag that question.");
			}
		},
		[client, flags],
	);

	useEffect(() => {
		if (!endTime) return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [endTime]);
	const secondsLeft = endTime ? Math.max(0, Math.ceil((endTime - now) / 1000)) : null;
	useEffect(() => {
		if (secondsLeft !== 0 || expired.current || !pageData) return;
		expired.current = true;
		toast.warning("Time's up. Submitting your answers.");
		void finish(true);
	}, [secondsLeft, pageData, finish]);

	/** Every value currently in the form (rendered fields plus edits). */
	const values = useMemo(() => (pageData ? quizAnswerData(pageData.questions, edits) : {}), [pageData, edits]);

	// the panel reflects unsaved answers and flag changes on the visible page
	const navItems = useMemo(
		() =>
			nav.map((item) => {
				const q = pageData?.questions.find((x) => x.slot === item.slot);
				const state = q && item.answerable ? (isQuestionAnswered(q, values) ? "complete" : "todo") : item.state;
				return { ...item, state, flagged: flags[item.slot] ?? item.flagged } satisfies QuizNavItem;
			}),
		[nav, pageData, values, flags],
	);

	return {
		ready: view !== null,
		error,
		retry: () => setReloads((n) => n + 1),
		view,
		pageData,
		nav: navItems,
		values,
		setAnswer,
		saveStatus,
		busy,
		secondsLeft,
		navigate,
		finish,
		toggleFlag,
		isFlagged: (q: QuizQuestion) => flags[q.slot] ?? q.flagged,
	};
}
