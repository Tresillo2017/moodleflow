"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SETTINGS_ITEM } from "@/lib/nav";
import { Logo } from "@/components/layout/logo";
import { NavUser } from "@/components/nav-user";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useUnreadCount } from "@/hooks/use-unread-count";
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
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";

const MAX_STARRED = 6;

function StarredCourses({ pathname }: { pathname: string }) {
	const { client } = useMoodleConnection();
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const starred = courses.data?.filter((c) => c.isFavourite && isCurrentCourse(c)).slice(0, MAX_STARRED) ?? [];

	if (starred.length === 0) return null;
	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel>Starred</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{starred.map((course) => {
						const href = `/courses/${course.id}`;
						return (
							<SidebarMenuItem key={course.id}>
								<SidebarMenuButton isActive={pathname === href} render={<Link href={href} />}>
									<span
										className="size-2 shrink-0 rounded-full"
										style={{ background: `oklch(0.68 0.15 ${courseHue(course.id)})` }}
										aria-hidden="true"
									/>
									<span className="truncate">{course.fullName}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();
	const unread = useUnreadCount();
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
								const badge = item.href === "/notifications" && unread > 0 ? unread : null;
								return (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton
											tooltip={badge ? `${item.label} (${badge})` : item.label}
											isActive={active}
											render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
										>
											<item.icon />
											<span>{item.label}</span>
										</SidebarMenuButton>
										{badge && (
											<SidebarMenuBadge className="bg-primary/15 text-primary tabular-nums">{badge}</SidebarMenuBadge>
										)}
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<StarredCourses pathname={pathname} />
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
