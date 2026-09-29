"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { ChatMessages } from "@/components/chat/chat-room";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/types/moodle";

const when = (seconds: number) => new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Archived sessions: pick one to read its transcript. */
export function ChatSessions({ chatId }: { chatId: number }) {
	const { client, refresh } = useMoodleConnection();
	const sessions = useMoodleQuery(client ? () => client.getChatSessions(chatId) : null, [client, chatId]);
	const [open, setOpen] = useState<ChatSession | null>(null);
	const log = useMoodleQuery(client && open ? () => client.getChatSessionMessages(chatId, open) : null, [client, chatId, open?.start]);

	if (sessions.loading) return <ListSkeleton rows={3} />;
	if (sessions.error) return <ErrorState error={sessions.error} onRetry={refresh} />;
	if (!sessions.data?.length) return <EmptyState icon={History} title="No past sessions" description="Sessions appear here once a conversation in the room has ended." />;

	return (
		<div className="grid min-h-80 overflow-hidden rounded-xl border bg-card md:grid-cols-[16rem_minmax(0,1fr)]">
			<ul className="divide-y border-r">
				{sessions.data.map((s) => (
					<li key={s.start}>
						<button type="button" onClick={() => setOpen(s)} aria-current={open?.start === s.start ? "true" : undefined} className={cn("w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", open?.start === s.start && "bg-muted")}>
							<span className="block font-medium">{when(s.start)}</span>
							<span className="block text-xs text-muted-foreground">
								{s.users.length} {s.users.length === 1 ? "person" : "people"} · {s.users.reduce((n, u) => n + u.messageCount, 0)} messages
							</span>
						</button>
					</li>
				))}
			</ul>
			<div className="flex min-h-64 flex-col">
				{!open && <p className="m-auto text-sm text-muted-foreground">Select a session to read it.</p>}
				{open && log.loading && <ListSkeleton rows={3} />}
				{open && log.error && <ErrorState error={log.error} />}
				{open && log.data && <ChatMessages messages={log.data} users={[]} />}
			</div>
		</div>
	);
}
