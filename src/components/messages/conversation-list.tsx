"use client";

import { BellOff, Star, Users } from "lucide-react";
import { PersonAvatar } from "@/components/people/person-avatar";
import { stripHtml } from "@/lib/moodle/normalize-messaging";
import { formatDistanceToNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MoodleConversation } from "@/types/moodle";

/** The other person's picture for private chats, the group picture otherwise. */
export function conversationImage(c: MoodleConversation, meId: number): string | undefined {
	return c.imageUrl ?? (c.type === 1 ? c.members.find((m) => m.id !== meId)?.imageUrl : undefined);
}

function Row({ c, meId, active, onSelect }: { c: MoodleConversation; meId: number; active: boolean; onSelect: (id: number) => void }) {
	const last = c.lastMessage;
	const preview = last ? `${last.fromUserId === meId ? "You: " : ""}${stripHtml(last.text)}` : "No messages yet";
	return (
		<li>
			<button
				type="button"
				onClick={() => onSelect(c.id)}
				aria-current={active ? "true" : undefined}
				className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", active && "bg-muted")}
			>
				{c.type === 2 ? (
					<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
						<Users className="size-4" aria-hidden="true" />
					</span>
				) : (
					<PersonAvatar name={c.name} imageUrl={conversationImage(c, meId)} />
				)}
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-1.5 text-sm">
						<span className={cn("truncate", c.unread > 0 ? "font-semibold" : "font-medium")}>{c.name}</span>
						{c.muted && <BellOff className="size-3 shrink-0 text-muted-foreground" aria-label="Muted" />}
					</span>
					<span className={cn("block truncate text-xs", c.unread > 0 ? "text-foreground" : "text-muted-foreground")}>{preview}</span>
				</span>
				<span className="flex shrink-0 flex-col items-end gap-1">
					{last && <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(last.time)}</span>}
					{c.unread > 0 && (
						<span className={cn("min-w-5 rounded-full px-1.5 text-center text-[11px] tabular-nums", c.muted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")} aria-label={`${c.unread} unread`}>
							{c.unread}
						</span>
					)}
				</span>
			</button>
		</li>
	);
}

export function ConversationList({ conversations, meId, selectedId, onSelect }: { conversations: MoodleConversation[]; meId: number; selectedId: number | null; onSelect: (id: number) => void }) {
	const favourites = conversations.filter((c) => c.favourite);
	const others = conversations.filter((c) => !c.favourite);
	const group = (label: string, list: MoodleConversation[], icon?: React.ReactNode) =>
		list.length > 0 && (
			<section>
				<h2 className="flex items-center gap-1 px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
					{icon}
					{label}
				</h2>
				<ul>
					{list.map((c) => (
						<Row key={c.id} c={c} meId={meId} active={c.id === selectedId} onSelect={onSelect} />
					))}
				</ul>
			</section>
		);
	return (
		<div className="flex flex-col divide-y">
			{group("Starred", favourites, <Star className="size-3" aria-hidden="true" />)}
			{group("Messages", others)}
		</div>
	);
}
