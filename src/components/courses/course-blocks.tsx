"use client";

import { Eye, EyeOff } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { usePreferences } from "@/components/providers/preferences-provider";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { blockKeys, isBlockHidden } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import type { CourseBlock } from "@/types/moodle";

/** Side blocks Moodle exposes with content. Right-click a block to hide it (here or everywhere); hidden ones can be restored. */
export function CourseBlocks({ courseId, blocks, className }: { courseId: number; blocks: CourseBlock[]; className?: string }) {
	const { prefs, setPref } = usePreferences();
	const hidden = prefs.hiddenBlocks;
	const shown = blocks.filter((b) => !isBlockHidden(hidden, courseId, b));
	const hiddenCount = blocks.length - shown.length;
	if (blocks.length === 0) return null;

	const hide = (key: string) => setPref("hiddenBlocks", [...hidden, key]);
	// restoring clears every hide rule that matches a block of this course
	const restoreAll = () => {
		const rules = new Set(blocks.flatMap((b) => Object.values(blockKeys(courseId, b))));
		setPref("hiddenBlocks", hidden.filter((k) => !rules.has(k)));
	};

	return (
		<aside aria-label="Course blocks" className={cn("flex flex-col gap-3", className)}>
			{shown.map((b) => (
				<ContextMenu key={b.id}>
					<ContextMenuTrigger render={<section className="rounded-xl border bg-card px-3 py-2.5" />}>
						<h2 className="mb-1 text-sm font-medium">{b.title}</h2>
						<RichContent html={b.html} className="text-xs text-muted-foreground [&_li]:ml-4 [&_p]:my-1" />
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem onClick={() => hide(blockKeys(courseId, b).course)}>
							<EyeOff /> Hide in this course
						</ContextMenuItem>
						<ContextMenuItem onClick={() => hide(blockKeys(courseId, b).everywhere)}>
							<EyeOff /> Hide in all courses
						</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
			))}
			{hiddenCount > 0 && (
				<button
					type="button"
					onClick={restoreAll}
					className="flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2"
				>
					<Eye className="size-3.5" aria-hidden="true" />
					Show {hiddenCount} hidden {hiddenCount === 1 ? "block" : "blocks"}
				</button>
			)}
		</aside>
	);
}
