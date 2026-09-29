"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SETTINGS_ITEM } from "@/lib/nav";
import { Logo } from "@/components/layout/logo";
import { NavUser } from "@/components/nav-user";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { Pin, PinOff, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CourseContextMenu } from "@/components/courses/course-context-menu";
import { usePinnedCourses } from "@/hooks/use-pinned-courses";
import type { MoodleCourse } from "@/types/moodle";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { courseHue } from "@/lib/format";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";

function CourseLink({ course, pathname, pinned }: { course: MoodleCourse; pathname: string; pinned: boolean }) {
	const { toggle } = usePinnedCourses();
	const href = `/courses/${course.id}`;
	return (
		<CourseContextMenu course={course} render={<SidebarMenuItem />}>
			<SidebarMenuButton tooltip={course.fullName} isActive={pathname === href} render={<Link href={href} />}>
				<span
					className="size-2 shrink-0 rounded-full"
					style={{ background: `oklch(0.68 0.15 ${courseHue(course.id)})` }}
					aria-hidden="true"
				/>
				<span className="truncate">{course.fullName}</span>
			</SidebarMenuButton>
			<SidebarMenuAction showOnHover onClick={() => toggle(course.id)} title={pinned ? "Unpin" : "Pin to sidebar"}>
				{pinned ? <PinOff /> : <Pin />}
				<span className="sr-only">{pinned ? `Unpin ${course.fullName}` : `Pin ${course.fullName}`}</span>
			</SidebarMenuAction>
		</CourseContextMenu>
	);
}

function CourseGroup({ label, courses, pathname, pinned, hideWhenCollapsed }: {
	label: string;
	courses: MoodleCourse[];
	pathname: string;
	pinned: boolean;
	hideWhenCollapsed?: boolean;
}) {
	if (courses.length === 0) return null;
	return (
		<SidebarGroup className={hideWhenCollapsed ? "group-data-[collapsible=icon]:hidden" : undefined}>
			<SidebarGroupLabel>{label}</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{courses.map((course) => (
						<CourseLink key={course.id} course={course} pathname={pathname} pinned={pinned} />
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

function CoursesNav({ pathname }: { pathname: string }) {
	const { client } = useMoodleConnection();
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const { pinnedIds } = usePinnedCourses();

	const all = courses.data ?? [];
	const pinned = pinnedIds.map((id) => all.find((c) => c.id === id)).filter((c): c is MoodleCourse => Boolean(c));
	const rest = all.filter((c) => !pinnedIds.includes(c.id)).sort((a, b) => a.fullName.localeCompare(b.fullName));
	const current = rest.filter(isCurrentCourse);
	const past = rest.filter((c) => !isCurrentCourse(c));

	return (
		<>
			{/* pinned stay visible when the sidebar collapses to icons */}
			<CourseGroup label="Pinned" courses={pinned} pathname={pathname} pinned />
			<CourseGroup label="Courses" courses={current} pathname={pathname} pinned={false} hideWhenCollapsed />
			{past.length > 0 && (
				<Collapsible className="group-data-[collapsible=icon]:hidden">
					<SidebarGroup>
						<CollapsibleTrigger className="group/past flex h-8 w-full items-center gap-1 rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-hidden hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring">
							<ChevronRight className="size-3.5 transition-transform group-data-panel-open/past:rotate-90" aria-hidden="true" />
							Past courses
							<span className="ml-auto tabular-nums">{past.length}</span>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<SidebarGroupContent>
								<SidebarMenu>
									{past.map((course) => (
										<CourseLink key={course.id} course={course} pathname={pathname} pinned={false} />
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</CollapsibleContent>
					</SidebarGroup>
				</Collapsible>
			)}
		</>
	);
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();
	const { setOpenMobile } = useSidebar();

	// On mobile the sidebar is a sheet; close it once a link has navigated.
	useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
								<Logo className="size-4" />
							</div>
							<div className="grid flex-1 text-left leading-tight">
								<span className="truncate font-semibold">MoodleFlow</span>
								<span className="truncate text-xs text-muted-foreground">Your Moodle, faster</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Platform</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{NAV_ITEMS.map((item) => {
								const active = pathname.startsWith(item.href);
								return (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton
											tooltip={item.label}
											isActive={active}
											render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
										>
											<item.icon />
											<span>{item.label}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<CoursesNav pathname={pathname} />
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip={SETTINGS_ITEM.label}
							isActive={pathname.startsWith(SETTINGS_ITEM.href)}
							render={<Link href={SETTINGS_ITEM.href} />}
						>
							<SETTINGS_ITEM.icon />
							<span>{SETTINGS_ITEM.label}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
