"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, FolderOpen, Link2, Pin, PinOff, Star, StarOff } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { usePinnedCourses } from "@/hooks/use-pinned-courses";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import type { MoodleCourse } from "@/types/moodle";

interface CourseContextMenuProps {
	course: MoodleCourse;
	children: React.ReactNode;
	/** Element the right-click area renders as (defaults to a div), e.g. `<SidebarMenuItem />` inside a list. */
	render?: React.ReactElement;
}

export function CourseContextMenu({ course, children, render }: CourseContextMenuProps) {
	const router = useRouter();
	const { client, refresh } = useMoodleConnection();
	const { isPinned, toggle } = usePinnedCourses();
	const href = `/courses/${course.id}`;
	const pinned = isPinned(course.id);

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(`${window.location.origin}${href}`);
			toast.success("Link copied");
		} catch {
			toast.error("Couldn't copy the link");
		}
	}

	async function toggleStar() {
		if (!client) return;
		try {
			await client.setCourseFavourite(course.id, !course.isFavourite);
			refresh();
		} catch {
			toast.error("Couldn't update the star in Moodle");
		}
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger render={render}>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem onClick={() => router.push(href)}>
					<FolderOpen /> Open
				</ContextMenuItem>
				<ContextMenuItem onClick={() => window.open(href, "_blank", "noopener")}>
					<ExternalLink /> Open in new tab
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={() => toggle(course.id)}>
					{pinned ? <PinOff /> : <Pin />} {pinned ? "Unpin from sidebar" : "Pin to sidebar"}
				</ContextMenuItem>
				{isCurrentCourse(course) && (
					<ContextMenuItem onClick={toggleStar}>
						{course.isFavourite ? <StarOff /> : <Star />} {course.isFavourite ? "Unstar in Moodle" : "Star in Moodle"}
					</ContextMenuItem>
				)}
				<ContextMenuSeparator />
				<ContextMenuItem onClick={copyLink}>
					<Link2 /> Copy link
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
