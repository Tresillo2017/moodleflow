"use client";

import { RichContent } from "@/components/content/rich-content";
import { cn } from "@/lib/utils";
import type { CourseBlock } from "@/types/moodle";

/** Side blocks Moodle exposes with content (announcements, latest news, upcoming events...). */
export function CourseBlocks({ blocks, className }: { blocks: CourseBlock[]; className?: string }) {
	if (blocks.length === 0) return null;
	return (
		<aside aria-label="Course blocks" className={cn("flex flex-col gap-3", className)}>
			{blocks.map((b) => (
				<section key={b.id} className="rounded-xl border bg-card px-3 py-2.5">
					<h2 className="mb-1 text-sm font-medium">{b.title}</h2>
					<RichContent html={b.html} className="text-xs text-muted-foreground [&_li]:ml-4 [&_p]:my-1" />
				</section>
			))}
		</aside>
	);
}
