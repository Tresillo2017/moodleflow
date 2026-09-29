"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Ban, BellOff, Bell, Loader2, Send, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichContent } from "@/components/content/rich-content";
import { PersonAvatar } from "@/components/people/person-avatar";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { MESSAGES_CHANGED } from "@/hooks/use-unread-messages";
import { conversationImage } from "@/components/messages/conversation-list";
import { formatDistanceToNow } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ConversationMessage, MoodleContact, MoodleConversation } from "@/types/moodle";

const POLL_MS = 5000;

interface ThreadProps {
	meId: number;
	/** An existing conversation, or a person to start one with (Moodle creates it on the first message). */
	conversation?: MoodleConversation;
	newContact?: MoodleContact;
	onBack: () => void;
	/** Something changed that the conversation list should reload (sent, muted, deleted, …). */
	onChanged: () => void;
	onStarted: (conversationId: number) => void;
}

/** Live conversation view: polls while visible, marks messages read, sends on Enter. */
export function MessageThread({ meId, conversation, newContact, onBack, onChanged, onStarted }: ThreadProps) {
	const { client } = useMoodleConnection();
	const [messages, setMessages] = useState<ConversationMessage[]>([]);
	const [members, setMembers] = useState<MoodleContact[]>(conversation?.members ?? []);
	const [loaded, setLoaded] = useState(!conversation);
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const bottom = useRef<HTMLDivElement>(null);
	const id = conversation?.id;
	const unread = conversation?.unread ?? 0;

	const load = useCallback(async () => {
		if (!client || id === undefined) return;
		try {
			const thread = await client.getConversationThread(id);
			setMessages(thread.messages);
			setMembers(thread.members);
			setLoaded(true);
		} catch {
			// keep what we have; the next poll retries
		}
	}, [client, id]);

	useEffect(() => {
		setMessages([]);
		setLoaded(!id);
		void load();
		const timer = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
		return () => clearInterval(timer);
	}, [id, load]);

	useEffect(() => {
		if (!client || id === undefined || unread === 0) return;
		client.markConversationRead(id).then(() => {
			onChanged();
			window.dispatchEvent(new Event(MESSAGES_CHANGED));
		}, () => {});
	}, [client, id, unread, messages.length, onChanged]);

	useEffect(() => {
		bottom.current?.scrollIntoView({ block: "end" });
	}, [messages.length]);

	async function send() {
		const body = text.trim();
		if (!client || !body || sending) return;
		setSending(true);
		try {
			if (id !== undefined) {
				await client.sendConversationMessage(id, body);
				setText("");
				await load();
				onChanged();
			} else if (newContact) {
				const created = await client.startConversation(newContact.id, body);
				setText("");
				onStarted(created);
			}
			window.dispatchEvent(new Event(MESSAGES_CHANGED));
		} catch {
			toast.error("Couldn't send your message.");
		} finally {
			setSending(false);
		}
	}

	async function run(action: () => Promise<void>, error: string) {
		try {
			await action();
			onChanged();
		} catch {
			toast.error(error);
		}
	}

	const other = conversation?.type === 1 ? members.find((m) => m.id !== meId) : undefined;
	const title = conversation?.name ?? newContact?.fullName ?? "";
	const blocked = other?.isBlocked ?? newContact?.isBlocked;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="flex items-center gap-2 border-b px-3 py-2">
				<Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label="Back to conversations">
					<ArrowLeft />
				</Button>
				<PersonAvatar name={title} imageUrl={conversation ? conversationImage(conversation, meId) : newContact?.imageUrl} size="sm" />
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-sm font-medium">{title}</h2>
					{conversation?.type === 2 && <p className="text-xs text-muted-foreground">{conversation.memberCount} members</p>}
					{other?.isOnline !== undefined && conversation?.type === 1 && <p className="text-xs text-muted-foreground">{other.isOnline ? "Online" : "Offline"}</p>}
				</div>
				{conversation && client && (
					<div className="flex items-center">
						<Button variant="ghost" size="icon-sm" aria-pressed={conversation.favourite} aria-label={conversation.favourite ? "Remove star" : "Star conversation"} title={conversation.favourite ? "Remove star" : "Star conversation"} onClick={() => run(() => client.setConversationFavourite(conversation.id, !conversation.favourite), "Couldn't update the conversation.")}>
							<Star className={conversation.favourite ? "fill-current" : undefined} />
						</Button>
						<Button variant="ghost" size="icon-sm" aria-pressed={conversation.muted} aria-label={conversation.muted ? "Unmute" : "Mute notifications"} title={conversation.muted ? "Unmute" : "Mute notifications"} onClick={() => run(() => client.setConversationMuted(conversation.id, !conversation.muted), "Couldn't update the conversation.")}>
							{conversation.muted ? <BellOff /> : <Bell />}
						</Button>
						{other && (
							<Button variant="ghost" size="icon-sm" aria-label={other.isBlocked ? `Unblock ${other.fullName}` : `Block ${other.fullName}`} title={other.isBlocked ? "Unblock" : "Block"} onClick={() => run(() => (other.isBlocked ? client.unblockUser(other.id) : client.blockUser(other.id)), "Couldn't change the block.")}>
								<Ban className={other.isBlocked ? "text-danger" : undefined} />
							</Button>
						)}
						{confirmDelete ? (
							<>
								<Button variant="destructive" size="xs" onClick={() => run(async () => { await client.deleteConversation(conversation.id); onBack(); }, "Couldn't delete the conversation.")}>
									Delete for me
								</Button>
								<Button variant="ghost" size="xs" onClick={() => setConfirmDelete(false)}>
									Keep
								</Button>
							</>
						) : (
							<Button variant="ghost" size="icon-sm" aria-label="Delete conversation" title="Delete conversation" onClick={() => setConfirmDelete(true)}>
								<Trash2 />
							</Button>
						)}
					</div>
				)}
			</header>

			<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite" aria-label="Messages">
				{!loaded && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-label="Loading" />}
				{loaded && messages.length === 0 && <p className="m-auto text-sm text-muted-foreground">Say hello to {title || "them"}.</p>}
				{messages.map((m, i) => {
					const mine = m.fromUserId === meId;
					const sender = members.find((x) => x.id === m.fromUserId);
					const showSender = conversation?.type === 2 && !mine && messages[i - 1]?.fromUserId !== m.fromUserId;
					return (
						<div key={m.id} className={cn("group/message flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
							{showSender && <span className="px-1 text-xs text-muted-foreground">{sender?.fullName ?? "Someone"}</span>}
							<div className={cn("flex max-w-[85%] items-center gap-1", mine && "flex-row-reverse")}>
								<div className={cn("rounded-2xl px-3 py-1.5", mine ? "bg-primary text-primary-foreground [&_a]:text-inherit" : "bg-muted")}>
									<RichContent html={m.text} className="text-sm [&_p]:my-0" />
								</div>
								{conversation && client && (
									<span className="flex opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100">
										<Button variant="ghost" size="icon-xs" aria-label="Delete message for me" title="Delete for me" onClick={() => run(async () => { await client.deleteMessage(m.id, false); await load(); }, "Couldn't delete the message.")}>
											<Trash2 />
										</Button>
										{conversation.canDeleteForAll && (
											<Button variant="ghost" size="icon-xs" aria-label="Delete message for everyone" title="Delete for everyone" onClick={() => run(async () => { await client.deleteMessage(m.id, true); await load(); }, "Couldn't delete the message.")}>
												<Ban />
											</Button>
										)}
									</span>
								)}
							</div>
							<time dateTime={m.time} className="px-1 text-[11px] text-muted-foreground">
								{formatDistanceToNow(m.time)}
							</time>
						</div>
					);
				})}
				<div ref={bottom} />
			</div>

			<form
				className="flex items-end gap-2 border-t p-3"
				onSubmit={(e) => {
					e.preventDefault();
					void send();
				}}
			>
				{blocked ? (
					<p className="flex-1 py-2 text-center text-sm text-muted-foreground">You blocked {title}. Unblock them to send messages.</p>
				) : (
					<>
						<Textarea
							value={text}
							onChange={(e) => setText(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									void send();
								}
							}}
							rows={1}
							placeholder="Write a message…"
							aria-label="Message"
							className="max-h-32 min-h-9 flex-1 resize-none"
						/>
						<Button type="submit" size="icon" disabled={!text.trim() || sending} aria-label="Send message">
							{sending ? <Loader2 className="animate-spin" /> : <Send />}
						</Button>
					</>
				)}
			</form>
		</div>
	);
}
