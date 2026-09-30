"use client";

import { Check, X } from "lucide-react";
import type { H5pAttempt } from "@/types/embed";

const duration = (seconds: number) => (seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`);

export function H5pAttempts({ attempts }: { attempts: H5pAttempt[] }) {
	if (!attempts.length) return null;
	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-2xl">Your attempts</h2>
			<ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
				{attempts.map((a) => (
					<li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
						<span className="font-medium">Attempt {a.attempt}</span>
						<span className="text-muted-foreground">{new Date(a.time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
						{a.score !== undefined && a.maxScore !== undefined && (
							<span className="tabular-nums">
								{a.score} / {a.maxScore}
							</span>
						)}
						{a.durationSeconds > 0 && <span className="text-muted-foreground">{duration(a.durationSeconds)}</span>}
						{a.success !== undefined && (
							<span className={`ml-auto flex items-center gap-1 ${a.success ? "text-success" : "text-muted-foreground"}`}>
								{a.success ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
								{a.success ? "Passed" : "Not passed"}
							</span>
						)}
						{a.success === undefined && a.completed !== undefined && <span className="ml-auto text-muted-foreground">{a.completed ? "Completed" : "In progress"}</span>}
					</li>
				))}
			</ul>
		</section>
	);
}
