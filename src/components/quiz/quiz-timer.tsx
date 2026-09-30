import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock } from "./quiz-format";

const WARNING_SECONDS = 60;

/** Countdown to the attempt's deadline. */
export function QuizTimer({ secondsLeft }: { secondsLeft: number }) {
	const urgent = secondsLeft <= WARNING_SECONDS;
	return (
		<div role="timer" aria-label="Time left" className={cn("flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium tabular-nums", urgent && "border-danger/50 text-danger")}>
			<Timer className="size-4" aria-hidden="true" />
			<span>{formatClock(secondsLeft)}</span>
			<span className="text-xs font-normal text-muted-foreground">left</span>
		</div>
	);
}
