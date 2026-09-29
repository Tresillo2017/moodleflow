"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Notifications stay reachable from the topbar bell; the sidebar sheet holds the rest.
const MOBILE_ITEMS = NAV_ITEMS.slice(0, 5);

export function MobileNav() {
	const pathname = usePathname();
	return (
		<nav
			aria-label="Primary"
			className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
		>
			{MOBILE_ITEMS.map((item) => {
				const active = pathname.startsWith(item.href);
				return (
					<Link
						key={item.href}
						href={item.href}
						aria-current={active ? "page" : undefined}
						className={cn(
							"relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors active:scale-95",
							active ? "text-primary" : "text-muted-foreground",
						)}
					>
						{active && (
							<motion.span
								layoutId="mobile-nav-indicator"
								className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
								transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
							/>
						)}
						<item.icon className="size-5" aria-hidden="true" />
						{item.label.replace("My ", "")}
					</Link>
				);
			})}
		</nav>
	);
}
