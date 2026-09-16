"use client";

import { CommandPalette } from "@/components/navigation/command-palette";
import { Logo } from "./logo";

export function Topbar() {
	return (
		<header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
			<div className="flex items-center gap-2 md:hidden">
				<Logo className="size-5 text-primary" />
			</div>
			<div className="flex-1">
				<CommandPalette />
			</div>
		</header>
	);
}
