"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { NOTIFICATIONS_CHANGED, useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "@/lib/format";
import { cn, isHttpUrl } from "@/lib/utils";
import type { MoodleNotification } from "@/types/moodle";

const MAX_SHOWN = 8;

/** Moodle sends HTML bodies; show them as plain text rather than injecting markup. */
function toPlainText(html: string): string {
	return new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
}

function Item({ n, onRead }: { n: MoodleNotification; onRead: (id: number) => void }) {
	const body = n.body ? toPlainText(n.body) : "";
	const content = (
		<>
			<span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
			<span className="min-w-0 flex-1">
				<span className={cn("block truncate", !n.read && "font-medium")}>{n.subject}</span>
				{body && <span className="line-clamp-2 text-xs text-muted-foreground">{body}</span>}
				<span className="mt-0.5 block text-xs text-muted-foreground">{formatDistanceToNow(n.timeCreated)}</span>
			</span>
			{!n.read && <span className="sr-only">Unread</span>}
		</>
	);
	const className = "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none";

	return isHttpUrl(n.url) ? (
		<a href={n.url} target="_blank" rel="noopener noreferrer" onClick={() => !n.read && onRead(n.id)} className={className}>
			{content}
		</a>
	) : (
		<button type="button" onClick={() => !n.read && onRead(n.id)} className={className}>
			{content}
		</button>
	);
}

export function NotificationsMenu() {
	const { client } = useMoodleConnection();
	const [version, setVersion] = useState(0);

	useEffect(() => {
		const bump = () => setVersion((v) => v + 1);
		window.addEventListener(NOTIFICATIONS_CHANGED, bump);
		return () => window.removeEventListener(NOTIFICATIONS_CHANGED, bump);
	}, []);

	const { data } = useMoodleQuery(client ? () => client.getNotifications() : null, [client, version]);
	const items = data ?? [];
	const unread = items.filter((n) => !n.read).length;
	const label = unread ? `Notifications, ${unread} unread` : "Notifications";

	// The client refreshes the list itself (NOTIFICATIONS_CHANGED), so failures just leave it as is.
	const markRead = (id: number) => void client?.markNotificationRead(id).catch(() => {});
	const markAllRead = () => void client?.markAllNotificationsRead().catch(() => {});

	return (
		<Popover>
			<PopoverTrigger
				render={<Button variant="ghost" size="icon" aria-label={label} title={label} className="relative" />}
			>
				<Bell aria-hidden="true" />
				{unread > 0 && (
					<span className="absolute top-1 right-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[9px] leading-none font-semibold text-primary-foreground tabular-nums">
						{unread > 9 ? "9+" : unread}
					</span>
				)}
			</PopoverTrigger>
			<PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-1.5rem))] gap-1 p-1.5">
				<div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
					<h2 className="text-xl">Notifications</h2>
					{unread > 0 && (
						<Button variant="ghost" size="xs" onClick={markAllRead}>
							<CheckCheck aria-hidden="true" />
							Mark all as read
						</Button>
					)}
				</div>
				{items.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
						<BellOff className="size-5" aria-hidden="true" />
						You're all caught up.
					</div>
				) : (
					<div className="flex max-h-96 flex-col overflow-y-auto">
						{items.slice(0, MAX_SHOWN).map((n) => (
							<Item key={n.id} n={n} onRead={markRead} />
						))}
					</div>
				)}
				{items.length > MAX_SHOWN && (
					<Button variant="ghost" size="sm" className="w-full" nativeButton={false} render={<Link href="/notifications" />}>
						View all {items.length}
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}
