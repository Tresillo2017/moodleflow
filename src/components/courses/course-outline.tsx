"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoodleSection } from "@/types/moodle";

export const sectionAnchor = (id: number) => `section-${id}`;

/** Sticky table of contents for a course: jump to a section, see progress, follow the section in view. */
export function CourseOutline({ sections, className }: { sections: MoodleSection[]; className?: string }) {
	const [active, setActive] = useState<number | undefined>(sections[0]?.id);

	useEffect(() => {
		const targets = sections
			.map((s) => document.getElementById(sectionAnchor(s.id)))
			.filter((el): el is HTMLElement => el !== null);
		if (targets.length === 0) return;
		const visible = new Set<string>();
		// a section counts as "current" while it crosses the upper third of the viewport
		const observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id);
				const first = targets.find((t) => visible.has(t.id));
				if (first) setActive(Number(first.id.replace("section-", "")));
			},
			{ rootMargin: "-10% 0px -60% 0px" },
		);
		targets.forEach((t) => observer.observe(t));
		return () => observer.disconnect();
	}, [sections]);

	return (
		<nav aria-label="Course sections" className={cn("flex flex-col gap-1", className)}>
			<p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Sections</p>
			{sections.map((s) => {
				const tracked = s.activities.filter((a) => a.completed !== undefined);
				const done = tracked.filter((a) => a.completed).length;
				const complete = tracked.length > 0 && done === tracked.length;
				return (
					<a
						key={s.id}
						href={`#${sectionAnchor(s.id)}`}
						aria-current={active === s.id ? "location" : undefined}
						onClick={(e) => {
							e.preventDefault();
							setActive(s.id);
							document.getElementById(sectionAnchor(s.id))?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
						className={cn(
							"flex items-start gap-2 rounded-lg border-l-2 px-3 py-1.5 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
							active === s.id ? "border-primary bg-muted/70 font-medium text-foreground" : "border-transparent text-muted-foreground",
						)}
					>
						<span className="min-w-0 flex-1 leading-snug break-words">{s.name}</span>
						{complete ? (
							<CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="All done" />
						) : (
							tracked.length > 0 && (
								<span className="mt-0.5 shrink-0 text-xs tabular-nums">
									{done}/{tracked.length}
								</span>
							)
						)}
					</a>
				);
			})}
		</nav>
	);
}
