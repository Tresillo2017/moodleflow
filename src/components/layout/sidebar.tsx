"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "./logo";
import { NAV_ITEMS, SETTINGS_ITEM } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name: string): string {
	return name
		.split(" ")
		.map((p) => p[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

export function Sidebar() {
	const pathname = usePathname();
	const { connection } = useMoodleConnection();

	return (
		<aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
			<div className="flex h-14 items-center gap-2 px-4">
				<Logo className="size-5 text-primary" />
				<span className="text-sm font-semibold tracking-tight">MoodleFlow</span>
			</div>
			<nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Primary">
				{NAV_ITEMS.map((item) => {
					const active = pathname.startsWith(item.href);
					return (
						<Link
							key={item.href}
							href={item.href}
							aria-current={active ? "page" : undefined}
							className={cn(
								"flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
								active
									? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
									: "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
							)}
						>
							<item.icon className="size-4" aria-hidden="true" />
							{item.label}
						</Link>
					);
				})}
			</nav>
			<div className="flex flex-col gap-0.5 border-t p-2">
				<Link
					href={SETTINGS_ITEM.href}
					className={cn(
						"flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
						pathname.startsWith(SETTINGS_ITEM.href)
							? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
							: "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
					)}
				>
					<SETTINGS_ITEM.icon className="size-4" aria-hidden="true" />
					{SETTINGS_ITEM.label}
				</Link>
				<Link
					href="/profile"
					className="mt-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-sidebar-accent"
				>
					<Avatar className="size-6">
						<AvatarFallback className="text-[10px]">
							{initials(connection?.userFullName ?? "?")}
						</AvatarFallback>
					</Avatar>
					<span className="truncate">{connection?.userFullName ?? "Account"}</span>
				</Link>
			</div>
		</aside>
	);
}

export function DisconnectAction() {
	const { disconnect } = useMoodleConnection();
	return (
		<button
			type="button"
			onClick={disconnect}
			className="flex items-center gap-2 text-sm text-muted-foreground hover:text-danger"
		>
			<LogOut className="size-4" aria-hidden="true" />
			Sign out
		</button>
	);
}
