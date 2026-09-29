"use client";

import { useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, ListSkeleton, FeatureGate } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn, isHttpUrl } from "@/lib/utils";
import { Bell, BellOff, CheckCheck, ChevronDown, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "@/lib/format";
import type { MoodleNotification } from "@/types/moodle";

type Filter = "all" | "unread";

/** Moodle sends HTML bodies; show them as plain text rather than injecting markup. */
function toPlainText(html: string): string {
	return new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
}

function NotificationItem({ notification: n, onRead }: { notification: MoodleNotification; onRead: (id: number) => void }) {
	const body = n.body ? toPlainText(n.body) : "";
	const expandable = Boolean(body) || isHttpUrl(n.url);

	return (
		<Collapsible
			onOpenChange={(open) => {
				if (open && !n.read) onRead(n.id);
			}}
			className={cn("transition-colors", !n.read && "bg-accent/40")}
		>
			<CollapsibleTrigger
				onClick={() => {
					if (!expandable && !n.read) onRead(n.id);
				}}
				className="group flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
			>
				<Bell
					className={cn("mt-0.5 size-4 shrink-0", n.read ? "text-muted-foreground" : "text-primary")}
					aria-hidden="true"
				/>
				<div className="min-w-0 flex-1">
					<p className={cn("truncate", !n.read && "font-medium")}>{n.subject}</p>
					<p className="mt-0.5 text-xs text-muted-foreground">{formatDistanceToNow(n.timeCreated)}</p>
				</div>
				{!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
				{expandable && (
					<ChevronDown
						className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-180"
						aria-hidden="true"
					/>
				)}
			</CollapsibleTrigger>
			{expandable && (
				<CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
					<div className="flex flex-col items-start gap-3 px-4 pb-4 pl-11 text-sm">
						{body && <p className="whitespace-pre-line text-muted-foreground">{body}</p>}
						{isHttpUrl(n.url) && (
							<Button
								variant="outline"
								size="sm"
								nativeButton={false}
								render={<a href={n.url} target="_blank" rel="noopener noreferrer" />}
							>
								Open in Moodle
								<ExternalLink aria-hidden="true" />
							</Button>
						)}
					</div>
				</CollapsibleContent>
			)}
		</Collapsible>
	);
}

function NotificationsPageContent() {
	const { client, refresh } = useMoodleConnection();
	const notifications = useMoodleQuery(client ? () => client.getNotifications() : null, [client]);
	const [readIds, setReadIds] = useState<Set<number>>(new Set());
	const [filter, setFilter] = useState<Filter>("all");

	const items = (notifications.data ?? []).map((n) => ({ ...n, read: n.read || readIds.has(n.id) }));
	const unreadCount = items.filter((n) => !n.read).length;
	// Items read during this visit stay in the Unread view so they don't vanish while being read.
	const visible = filter === "unread" ? items.filter((n) => !n.read || readIds.has(n.id)) : items;

	async function markRead(id: number) {
		setReadIds((prev) => new Set(prev).add(id));
		try {
			await client?.markNotificationRead(id);
		} catch {
			// optimistic update stands; the next refresh reconciles with Moodle
		}
	}

	async function markAllRead() {
		setReadIds(new Set(items.map((n) => n.id)));
		try {
			await client?.markAllNotificationsRead();
		} catch {
			// optimistic update stands; the next refresh reconciles with Moodle
		}
	}

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Notifications"
				description={notifications.data ? (unreadCount ? `${unreadCount} unread` : "You're all caught up") : undefined}
				actions={
					unreadCount > 0 && (
						<Button variant="outline" size="sm" onClick={markAllRead}>
							<CheckCheck aria-hidden="true" />
							Mark all as read
						</Button>
					)
				}
			/>

			{notifications.data && items.length > 0 && (
				<Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
					<TabsList>
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="unread">
							Unread
							{unreadCount > 0 && (
								<span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary tabular-nums">{unreadCount}</span>
							)}
						</TabsTrigger>
					</TabsList>
				</Tabs>
			)}

			{notifications.loading && <ListSkeleton rows={5} />}
			{notifications.error && <ErrorState error={notifications.error} onRetry={refresh} />}
			{notifications.data && visible.length === 0 && (
				<EmptyState
					icon={BellOff}
					title={filter === "unread" && items.length > 0 ? "No unread notifications" : "No notifications"}
					description="You're all caught up."
				/>
			)}
			{visible.length > 0 && (
				<div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
					{visible.map((n) => (
						<NotificationItem key={n.id} notification={n} onRead={markRead} />
					))}
				</div>
			)}
		</div>
	);
}

export default function NotificationsPage() {
	return (
		<FeatureGate feature="Notifications" functions={["message_popup_get_popup_notifications"]}>
			<NotificationsPageContent />
		</FeatureGate>
	);
}
