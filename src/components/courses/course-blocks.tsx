"use client";

import { RichContent } from "@/components/content/rich-content";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";

/** Side blocks Moodle exposes with content (announcements, latest news, upcoming events...). Renders nothing when empty. */
export function CourseBlocks({ courseId, className }: { courseId: number; className?: string }) {
	const { client } = useMoodleConnection();
	const blocks = useMoodleQuery(client ? () => client.getCourseBlocks(courseId) : null, [client, courseId]);
	if (!blocks.data?.length) return null;
	return (
		<aside aria-label="Course blocks" className={className}>
			{blocks.data.map((b) => (
				<section key={b.id} className="rounded-xl border bg-card px-4 py-3">
					<h2 className="mb-1 text-base">{b.title}</h2>
					<RichContent html={b.html} className="text-xs text-muted-foreground" />
				</section>
			))}
		</aside>
	);
}
