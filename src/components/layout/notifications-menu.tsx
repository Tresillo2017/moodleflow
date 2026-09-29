"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCheck, Trash2, X } from "lucide-react";
import { NOTIFICATIONS_CHANGED, useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useMoodleLinkOpener } from "@/hooks/use-moodle-link";
import { useDismissedNotifications } from "@/hooks/use-dismissed-notifications";
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

interface ItemProps {
	n: MoodleNotification;
	onRead: (id: number) => void;
	onDismiss: (id: number) => void;
	/** Called after the notification's link was followed inside the app. */
	onNavigate: () => void;
}

function Item({ n, onRead, onDismiss, onNavigate }: ItemProps) {
	const open = useMoodleLinkOpener();
	const body = n.body ? toPlainText(n.body) : "";
	const rowClass = cn(
		"flex min-w-0 flex-1 items-start gap-3 rounded-[inherit] px-2.5 py-2 text-left text-sm outline-none",
		"focus-visible:bg-muted/60",
	);
	const content = (
		<>
			<span
				className={cn(
					"mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
					n.read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
				)}
				aria-hidden="true"
			>
				<Bell className="size-3.5" />
			</span>
			<span className="min-w-0 flex-1">
				<span className={cn("block truncate", !n.read && "font-medium")}>{n.subject}</span>
				{body && <span className="line-clamp-2 text-xs text-muted-foreground">{body}</span>}
				<span className="mt-0.5 block text-xs text-muted-foreground/80">{formatDistanceToNow(n.timeCreated)}</span>
			</span>
			{!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" role="img" aria-label="Unread" />}
		</>
	);

	return (
		<li className="group/item relative flex rounded-xl transition-colors hover:bg-muted/50 motion-safe:animate-track-in">
			{isHttpUrl(n.url) ? (
				<a
					href={n.url}
					target="_blank"
					rel="noopener noreferrer"
					onClick={(e) => {
						if (!n.read) onRead(n.id);
						// plain clicks open the matching MoodleFlow page; modified clicks keep the browser's behaviour
						if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
						e.preventDefault();
						void open(n.url!);
						onNavigate();
					}}
					className={rowClass}
				>
					{content}
				</a>
			) : (
				<button type="button" onClick={() => !n.read && onRead(n.id)} className={rowClass}>
					{content}
				</button>
			)}
			<button
				type="button"
				onClick={() => onDismiss(n.id)}
				aria-label={`Dismiss ${n.subject}`}
				className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md bg-popover/90 text-muted-foreground opacity-0 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100 hover:text-foreground focus-visible:opacity-100"
			>
				<X className="size-3.5" aria-hidden="true" />
			</button>
		</li>
	);
}

export function NotificationsMenu() {
	const { client } = useMoodleConnection();
	const { dismissed, dismiss } = useDismissedNotifications();
	const [version, setVersion] = useState(0);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const bump = () => setVersion((v) => v + 1);
		window.addEventListener(NOTIFICATIONS_CHANGED, bump);
		return () => window.removeEventListener(NOTIFICATIONS_CHANGED, bump);
	}, []);

	const { data } = useMoodleQuery(client ? () => client.getNotifications() : null, [client, version]);
	const items = (data ?? []).filter((n) => !dismissed.includes(n.id));
	const unread = items.filter((n) => !n.read).length;
	const label = unread ? `Notifications, ${unread} unread` : "Notifications";

	// The client refreshes the list itself (NOTIFICATIONS_CHANGED), so failures just leave it as is.
	const markRead = (id: number) => void client?.markNotificationRead(id).catch(() => {});
	const markAllRead = () => void client?.markAllNotificationsRead().catch(() => {});
	const clearAll = () => {
		dismiss(items.map((n) => n.id));
		if (unread) markAllRead();
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={label} title={label} className="relative" />}>
				<Bell aria-hidden="true" />
				{unread > 0 && (
					<span className="absolute top-1 right-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[9px] leading-none font-semibold text-primary-foreground tabular-nums">
						{unread > 9 ? "9+" : unread}
					</span>
				)}
			</PopoverTrigger>
			<PopoverContent align="end" sideOffset={8} className="w-[min(25rem,calc(100vw-1.5rem))] gap-0 p-0">
				<div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
					<h2 className="flex items-baseline gap-2">
						Notifications
						{unread > 0 && (
							<span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-sans text-xs font-medium text-primary not-italic tabular-nums">
								{unread} new
							</span>
						)}
					</h2>
					<div className="flex items-center gap-1">
						<Button variant="ghost" size="xs" onClick={markAllRead} disabled={unread === 0}>
							<CheckCheck aria-hidden="true" />
							Read all
						</Button>
						<Button variant="ghost" size="xs" onClick={clearAll} disabled={items.length === 0}>
							<Trash2 aria-hidden="true" />
							Clear
						</Button>
					</div>
				</div>
				<div className="mx-3 h-px bg-border" />
				{items.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
						<span className="grid size-10 place-items-center rounded-full bg-muted">
							<BellOff className="size-5" aria-hidden="true" />
						</span>
						You're all caught up.
					</div>
				) : (
					<ul className="flex max-h-[26rem] flex-col gap-0.5 overflow-y-auto p-1.5">
						{items.slice(0, MAX_SHOWN).map((n) => (
							<Item key={n.id} n={n} onRead={markRead} onDismiss={(id) => dismiss([id])} onNavigate={() => setOpen(false)} />
						))}
					</ul>
				)}
				{items.length > MAX_SHOWN && (
					<div className="border-t p-1.5">
						<Button variant="ghost" size="sm" className="w-full" nativeButton={false} render={<Link href="/notifications" />}>
							View all {items.length}
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
