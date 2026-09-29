"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import { SeasonParticles } from "./season-particles";

const WIDTHS = { normal: "max-w-5xl", wide: "max-w-7xl", full: "max-w-none" } as const;

export function AppShell({ children }: { children: React.ReactNode }) {
	const { prefs } = usePreferences();

	return (
		<SidebarProvider>
			<SeasonParticles />
			<AppSidebar variant={prefs.sidebar} />
			<SidebarInset className="min-w-0">
				<Topbar />
				{/* SidebarInset is already the <main> landmark */}
				<div className="flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
					<div className={cn("mx-auto w-full", WIDTHS[prefs.width])}>{children}</div>
				</div>
				<MobileNav />
			</SidebarInset>
		</SidebarProvider>
	);
}
