"use client";

import { CheckCircle2, Circle, ExternalLink, Info, XCircle } from "lucide-react";
import { cn, isHttpUrl } from "@/lib/utils";
import type { PlanTaskStatus, WorkshopPlanPhase } from "@/types/workshop";

const TASK_ICON: Record<PlanTaskStatus, { Icon: typeof Circle; className: string; label: string }> = {
	done: { Icon: CheckCircle2, className: "text-success", label: "Done" },
	todo: { Icon: Circle, className: "text-muted-foreground", label: "To do" },
	fail: { Icon: XCircle, className: "text-danger", label: "Failed" },
	info: { Icon: Info, className: "text-muted-foreground", label: "Info" },
};

/** Workshop phases as a stepper, with the current phase's tasks underneath. */
export function PhasePlanner({ plan }: { plan: WorkshopPlanPhase[] }) {
	const active = plan.find((p) => p.active);
	const activeIndex = plan.findIndex((p) => p.active);
	return (
		<section aria-label="Workshop phases" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
			<ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
				{plan.map((p, i) => (
					<li
						key={p.code}
						aria-current={p.active ? "step" : undefined}
						className={cn(
							"flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-xs",
							p.active ? "border-primary bg-primary/5 font-medium" : i < activeIndex ? "text-muted-foreground" : "text-muted-foreground/70",
						)}
					>
						<span className="tabular-nums text-muted-foreground">Phase {i + 1}</span>
						<span>{p.title}</span>
					</li>
				))}
			</ol>
			{active && active.tasks.length > 0 && (
				<ul className="flex flex-col gap-2">
					{active.tasks.map((t, i) => {
						const { Icon, className, label } = TASK_ICON[t.status];
						return (
							<li key={`${t.title}-${i}`} className="flex items-start gap-2 text-sm">
								<Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-label={label} />
								<span className="flex-1">
									{t.title}
									{t.details && <span className="ml-2 text-xs text-muted-foreground">{t.details}</span>}
								</span>
								{isHttpUrl(t.link) && (
									<a href={t.link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label={`Open “${t.title}” in Moodle`}>
										<ExternalLink className="size-3.5" aria-hidden="true" />
									</a>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
