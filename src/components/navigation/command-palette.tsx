"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS, SETTINGS_ITEM } from "@/lib/nav";
import { Moon, Search, Sun, LogOut } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const { setTheme, resolvedTheme } = useTheme();
	const { disconnect } = useMoodleConnection();

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((o) => !o);
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	function run(action: () => void) {
		setOpen(false);
		action();
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
			>
				<Search className="size-4" aria-hidden="true" />
				<span className="flex-1 text-left">Search Moodle</span>
				<kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
			</button>
			<CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search and navigate MoodleFlow">
				<CommandInput placeholder="Type a command or search..." />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					<CommandGroup heading="Navigate">
						{[...NAV_ITEMS, SETTINGS_ITEM].map((item) => (
							<CommandItem key={item.href} onSelect={() => run(() => router.push(item.href))}>
								<item.icon className="size-4" aria-hidden="true" />
								Go to {item.label}
							</CommandItem>
						))}
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading="Actions">
						<CommandItem
							onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
						>
							{resolvedTheme === "dark" ? (
								<Sun className="size-4" aria-hidden="true" />
							) : (
								<Moon className="size-4" aria-hidden="true" />
							)}
							Toggle dark mode
						</CommandItem>
						<CommandItem onSelect={() => run(disconnect)}>
							<LogOut className="size-4" aria-hidden="true" />
							Sign out
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
}
