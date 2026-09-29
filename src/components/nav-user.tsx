"use client";

import Link from "next/link";
import { LogOutIcon, ChevronsUpDownIcon, UserIcon, SettingsIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useMoodleConnection } from "@/components/providers/moodle-provider";

function initials(name: string): string {
	return name
		.split(" ")
		.map((p) => p[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

export function NavUser() {
	const { isMobile } = useSidebar();
	const { connection, disconnect } = useMoodleConnection();
	const name = connection?.userFullName ?? "Account";
	const site = connection?.siteName ?? connection?.siteUrl ?? "";

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}>
						<Avatar className="size-8 rounded-lg">
							<AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-medium">{name}</span>
							<span className="truncate text-xs text-muted-foreground">{site}</span>
						</div>
						<ChevronsUpDownIcon className="ml-auto size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-56" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar className="size-8 rounded-lg">
										<AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{name}</span>
										<span className="truncate text-xs text-muted-foreground">{site}</span>
									</div>
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
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
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
