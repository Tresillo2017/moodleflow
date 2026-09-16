"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<div className="flex min-w-0 flex-1 flex-col">
				<Topbar />
				<main className="flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-8">
					<div className="mx-auto w-full max-w-5xl">{children}</div>
				</main>
			</div>
			<MobileNav />
		</div>
	);
}
