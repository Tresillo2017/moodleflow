"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ChevronDown, LogOutIcon, Moon, RotateCw, SettingsIcon, Sun, UserIcon } from "lucide-react";
import { CommandPalette } from "@/components/navigation/command-palette";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { usePinnedCourses } from "@/hooks/use-pinned-courses";
import { courseHue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MoodleCourse } from "@/types/moodle";
import { Logo } from "./logo";
import { NotificationsMenu } from "./notifications-menu";

/** Pinned courses shown as quick links next to the logo. */
const MAX_QUICK_LINKS = 3;

export interface ShellUser {
	name: string;
	site: string;
	picture: string | null;
}

export function initials(name: string): string {
	return name
		.split(" ")
		.map((p) => p[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

/** Uploaded picture or initials on an accent tile; fills whatever box it is given. */
export function UserPicture({ user, className }: { user: ShellUser; className?: string }) {
	const [failed, setFailed] = useState(false);
	return (
		<span className={cn("sh-picture", className)}>
			{user.picture && !failed ? (
				// eslint-disable-next-line @next/next/no-img-element -- remote Moodle avatar, any host
				<img src={user.picture} alt="" draggable={false} onError={() => setFailed(true)} />
			) : (
				<span aria-hidden="true">{initials(user.name)}</span>
			)}
		</span>
	);
}

function MastheadAction({ label, children }: { label: string; children: React.ReactElement }) {
	return (
		<Tooltip>
			<TooltipTrigger render={children} />
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

function RefreshButton() {
	const { refresh } = useMoodleConnection();
	// Cumulative rotation: each click spins the icon once more, without resetting mid-turn.
	const [turns, setTurns] = useState(0);
	return (
		<MastheadAction label="Refresh data">
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
		</MastheadAction>
	);
}

function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const next = resolvedTheme === "dark" ? "light" : "dark";
	return (
		<MastheadAction label={`Switch to ${next} mode`}>
			<Button variant="ghost" size="icon" aria-label={`Switch to ${next} mode`} onClick={() => setTheme(next)}>
				<Sun className="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" aria-hidden="true" />
				<Moon className="absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" aria-hidden="true" />
			</Button>
		</MastheadAction>
	);
}

function QuickLinks() {
	const { client } = useMoodleConnection();
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const { pinnedIds } = usePinnedCourses();
	const pinned = pinnedIds
		.map((id) => courses.data?.find((c) => c.id === id))
		.filter((c): c is MoodleCourse => Boolean(c))
		.slice(0, MAX_QUICK_LINKS);

	return pinned.map((course) => (
		<Link key={course.id} href={`/courses/${course.id}`} className="sh-quick" title={course.fullName}>
			<span className="size-2 shrink-0 rounded-full" style={{ background: `oklch(0.68 0.15 ${courseHue(course.id)})` }} aria-hidden="true" />
			<span className="truncate">{course.shortName}</span>
		</Link>
	));
}

/** The account button: avatar + name on desktop, a Me tab in the mobile bar. */
export function AccountMenu({ user, variant = "masthead" }: { user: ShellUser; variant?: "masthead" | "mobile" }) {
	const { disconnect } = useMoodleConnection();
	const firstName = user.name.split(" ")[0];
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={variant === "mobile" ? "sh-mctl" : "sh-account"}
				aria-label={`Account: ${user.name}`}
			>
				<UserPicture user={user} className={variant === "mobile" ? "sh-mctl-avatar" : "size-5"} />
				{variant === "mobile" ? <span className="sh-mctl-label">Me</span> : <span className="sh-account-name">{firstName}</span>}
				{variant === "masthead" && <ChevronDown aria-hidden="true" />}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60 overflow-hidden" side={variant === "mobile" ? "top" : "bottom"} align="end" sideOffset={8}>
				<div className="sh-acct-head">
					{user.picture && <span className="sh-acct-wash" style={{ backgroundImage: `url(${user.picture})` }} aria-hidden="true" />}
					<UserPicture user={user} className="size-8" />
					<div className="grid min-w-0 text-sm leading-tight">
						<span className="truncate font-medium">{user.name}</span>
						<span className="truncate text-xs text-muted-foreground">{user.site}</span>
					</div>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem render={<Link href="/profile" />}>
						<UserIcon />
						Profile
					</DropdownMenuItem>
					<DropdownMenuItem render={<Link href="/settings" />}>
						<SettingsIcon />
						Settings
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={disconnect} variant="destructive">
					<LogOutIcon />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Fixed, transparent 48px bar: logo, pinned courses and search on the left; actions and account on the right. */
export function Masthead({ user }: { user: ShellUser }) {
	return (
		<header className="sh-masthead">
			<div className="sh-masthead-inner">
				<div className="sh-cluster sh-cluster-left">
					<Link href="/dashboard" className="sh-logo" aria-label="MoodleFlow">
						<Logo className="size-[18px]" />
						<span className="sh-logo-word">MoodleFlow</span>
						<span className="sh-logo-version">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
					</Link>
					<div className="sh-quicklinks">
						<QuickLinks />
					</div>
					<CommandPalette />
				</div>
				<div className="sh-cluster">
					<RefreshButton />
					<NotificationsMenu />
					<ThemeToggle />
					<span className="sh-account-sep" aria-hidden="true" />
					<div className="sh-account-slot">
						<AccountMenu user={user} />
					</div>
				</div>
			</div>
		</header>
	);
}
