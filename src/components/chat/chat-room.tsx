"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/people/person-avatar";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { ErrorState } from "@/components/ui/state";
import { chatMessageText } from "@/lib/moodle/normalize-chat";
import { MoodleError } from "@/types/moodle";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatRoom as Room, MoodleContact } from "@/types/moodle";

const POLL_MS = 3000;
const USERS_POLL_MS = 15_000;
/** Messages kept in memory; older ones scroll away for good (past sessions hold the full log). */
const MAX_MESSAGES = 500;

export function ChatMessages({ messages, users, meId }: { messages: ChatMessage[]; users: MoodleContact[]; meId?: number }) {
	const bottom = useRef<HTMLDivElement>(null);
	const nameOf = (id: number) => (id === meId ? "You" : (users.find((u) => u.id === id)?.fullName ?? "Someone"));
	useEffect(() => {
		bottom.current?.scrollIntoView({ block: "end" });
	}, [messages.length]);
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Chat messages">
			{messages.length === 0 && <p className="m-auto text-sm text-muted-foreground">No messages yet.</p>}
			{messages.map((m) =>
				m.system || m.text.startsWith("beep ") ? (
					<p key={m.id} className="text-center text-xs text-muted-foreground">
						{chatMessageText(m, nameOf)}
					</p>
				) : (
					<div key={m.id} className={cn("flex items-end gap-2", m.userId === meId && "flex-row-reverse")}>
						<PersonAvatar name={nameOf(m.userId)} imageUrl={users.find((u) => u.id === m.userId)?.imageUrl} size="sm" />
						<div className={cn("max-w-[80%] rounded-2xl px-3 py-1.5 text-sm", m.userId === meId ? "bg-primary text-primary-foreground" : "bg-muted")}>
							{m.userId !== meId && <p className="text-xs font-medium opacity-70">{nameOf(m.userId)}</p>}
							<p className="break-words whitespace-pre-wrap">{m.text}</p>
						</div>
					</div>
				),
			)}
			<div ref={bottom} />
		</div>
	);
}

/** Live room: joins, polls for new messages, shows who's here, and sends. */
export function LiveChat({ chatId }: { chatId: number }) {
	const { client, refresh } = useMoodleConnection();
	const [room, setRoom] = useState<Room | null>(null);
	const [error, setError] = useState<MoodleError | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [users, setUsers] = useState<MoodleContact[]>([]);
	const [meId, setMeId] = useState<number>();
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const lastTime = useRef(0);
	const seen = useRef(new Set<number>());

	useEffect(() => {
		if (!client) return;
		let cancelled = false;
		lastTime.current = 0;
		seen.current = new Set();
		setMessages([]);
		client.getCurrentUser().then((u) => !cancelled && setMeId(u.id), () => {});
		client.joinChat(chatId).then(
			(r) => !cancelled && setRoom(r),
			(e: unknown) => !cancelled && setError(e instanceof MoodleError ? e : new MoodleError("unknown_error", "Couldn't join the chat.")),
		);
		return () => {
			cancelled = true;
		};
	}, [client, chatId]);

	useEffect(() => {
		if (!client || !room) return;
		let cancelled = false;
		const poll = async () => {
			if (document.visibilityState !== "visible") return;
			try {
				const result = await client.pollChat(room, lastTime.current);
				if (cancelled) return;
				lastTime.current = result.lastTime || lastTime.current;
				const fresh = result.messages.filter((m) => !seen.current.has(m.id));
				fresh.forEach((m) => seen.current.add(m.id));
				if (fresh.length) setMessages((all) => [...all, ...fresh].slice(-MAX_MESSAGES));
			} catch {
				// transient; the next poll retries
			}
		};
		const loadUsers = () => client.getChatUsers(room).then((u) => !cancelled && setUsers(u), () => {});
		void poll();
		void loadUsers();
		const timer = setInterval(poll, POLL_MS);
		const usersTimer = setInterval(loadUsers, USERS_POLL_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
			clearInterval(usersTimer);
		};
	}, [client, room]);

	async function send() {
		const body = text.trim();
		if (!client || !room || !body || sending) return;
		setSending(true);
		try {
			await client.sendChatMessage(room, body);
			setText("");
		} catch {
			toast.error("Couldn't send your message.");
		} finally {
			setSending(false);
		}
	}

	if (error) return <ErrorState error={error} onRetry={refresh} />;
	if (!room) return <Loader2 className="mx-auto my-16 size-5 animate-spin text-muted-foreground" aria-label="Joining chat" />;

	return (
		<div className="grid h-[calc(100dvh-20rem)] min-h-80 overflow-hidden rounded-xl border bg-card md:grid-cols-[minmax(0,1fr)_14rem]">
			<div className="flex min-h-0 flex-col">
				<ChatMessages messages={messages} users={users} meId={meId} />
				<form
					className="flex gap-2 border-t p-3"
					onSubmit={(e) => {
						e.preventDefault();
						void send();
					}}
				>
					<Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something…" aria-label="Message" maxLength={2000} />
					<Button type="submit" size="icon" disabled={!text.trim() || sending} aria-label="Send message">
						{sending ? <Loader2 className="animate-spin" /> : <Send />}
					</Button>
				</form>
			</div>
			<aside className="hidden overflow-y-auto border-l p-3 md:block" aria-label="In this chat">
				<h2 className="pb-2 text-xs font-medium text-muted-foreground">In this chat ({users.length})</h2>
				<ul className="flex flex-col gap-2">
					{users.map((u) => (
						<li key={u.id} className="flex items-center gap-2 text-sm">
							<PersonAvatar name={u.fullName} imageUrl={u.imageUrl} size="sm" />
							<span className="truncate">{u.fullName}</span>
						</li>
					))}
				</ul>
			</aside>
		</div>
	);
}
