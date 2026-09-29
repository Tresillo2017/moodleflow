"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, Moon, RotateCw, Sun } from "lucide-react";
import { CommandPalette } from "@/components/navigation/command-palette";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useUnreadCount } from "@/hooks/use-unread-count";
import { NAV_ITEMS, PROFILE_ITEM, SETTINGS_ITEM } from "@/lib/nav";

function TopbarAction({ label, children }: { label: string; children: React.ReactElement }) {
	return (
		<Tooltip>
			<TooltipTrigger render={children} />
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

function PageBreadcrumb() {
	const pathname = usePathname();
	const { client } = useMoodleConnection();
	const section = [...NAV_ITEMS, SETTINGS_ITEM, PROFILE_ITEM].find((item) => pathname.startsWith(item.href));
	const courseId = Number(pathname.match(/^\/courses\/(\d+)/)?.[1]);
	const courses = useMoodleQuery(client && courseId ? () => client.getCourses() : null, [client, courseId]);
	const course = courses.data?.find((c) => c.id === courseId);

	if (!section) return null;
	return (
		<Breadcrumb className="min-w-0 flex-1">
			<BreadcrumbList className="flex-nowrap">
				{course ? (
					<>
						<BreadcrumbItem className="hidden sm:inline-flex">
							<BreadcrumbLink render={<Link href={section.href} />}>{section.label}</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden sm:inline-flex" />
						<BreadcrumbItem className="min-w-0">
							<BreadcrumbPage className="truncate">{course.shortName}</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				) : (
					<BreadcrumbItem>
						<BreadcrumbPage>{section.label}</BreadcrumbPage>
					</BreadcrumbItem>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

function RefreshButton() {
	const { refresh } = useMoodleConnection();
	// Cumulative rotation: each click spins the icon once more, without resetting mid-turn.
	const [turns, setTurns] = useState(0);

	return (
		<TopbarAction label="Refresh data">
			<Button
				variant="ghost"
				size="icon"
				aria-label="Refresh data"
				onClick={() => {
					setTurns((t) => t + 1);
					refresh();
				}}
			>
				<RotateCw
					className="transition-transform duration-500 ease-out"
					style={{ transform: `rotate(${turns * 360}deg)` }}
					aria-hidden="true"
				/>
			</Button>
		</TopbarAction>
	);
}

function NotificationsButton() {
	const unread = useUnreadCount();
	const label = unread ? `Notifications, ${unread} unread` : "Notifications";

	return (
		<TopbarAction label={label}>
			<Button
				variant="ghost"
				size="icon"
				aria-label={label}
				className="relative"
				nativeButton={false}
				render={<Link href="/notifications" />}
			>
				<Bell aria-hidden="true" />
				{unread > 0 && (
					<span className="absolute top-1 right-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[9px] leading-none font-semibold text-primary-foreground tabular-nums motion-safe:animate-in motion-safe:zoom-in-50">
						{unread > 9 ? "9+" : unread}
					</span>
				)}
			</Button>
		</TopbarAction>
	);
}

function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const next = resolvedTheme === "dark" ? "light" : "dark";

	return (
		<TopbarAction label={`Switch to ${next} mode`}>
			<Button variant="ghost" size="icon" aria-label={`Switch to ${next} mode`} onClick={() => setTheme(next)}>
				<Sun className="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" aria-hidden="true" />
				<Moon className="absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" aria-hidden="true" />
			</Button>
		</TopbarAction>
	);
}

export function Topbar() {
	return (
		<header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-lg md:px-4">
			<SidebarTrigger className="-ml-0.5" />
			<Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-center" />
			<PageBreadcrumb />
			<div className="ml-auto flex items-center gap-1">
				<CommandPalette />
				<RefreshButton />
				<NotificationsButton />
				<ThemeToggle />
			</div>
		</header>
	);
}
