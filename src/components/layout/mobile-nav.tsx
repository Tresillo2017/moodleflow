"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav() {
	const pathname = usePathname();
	return (
		<nav
			aria-label="Primary"
			className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 backdrop-blur md:hidden"
		>
			{NAV_ITEMS.slice(0, 5).map((item) => {
				const active = pathname.startsWith(item.href);
				return (
					<Link
						key={item.href}
						href={item.href}
						aria-current={active ? "page" : undefined}
						className={cn(
							"flex flex-1 flex-col items-center gap-1 py-2 text-[11px]",
							active ? "text-primary" : "text-muted-foreground",
						)}
					>
						<item.icon className="size-5" aria-hidden="true" />
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
