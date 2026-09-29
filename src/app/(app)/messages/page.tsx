"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { PageHeader } from "@/components/layout/page-header";
import { ConversationList } from "@/components/messages/conversation-list";
import { MessageThread } from "@/components/messages/message-thread";
import { PeoplePanel } from "@/components/messages/people-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { cn } from "@/lib/utils";
import type { MoodleContact } from "@/types/moodle";

const LIST_POLL_MS = 15_000;

type Selection = { conversationId: number } | { contact: MoodleContact } | null;

function MessagesContent() {
	const { client, refresh } = useMoodleConnection();
	const params = useSearchParams();
	const [tab, setTab] = useState<"chats" | "people">("chats");
	const [selection, setSelection] = useState<Selection>(() => {
		const c = Number(params.get("c"));
		return c ? { conversationId: c } : null;
	});
	const [version, setVersion] = useState(0);
	const me = useMoodleQuery(client ? () => client.getCurrentUser() : null, [client]);
	const conversations = useMoodleQuery(client ? () => client.getConversations() : null, [client, version]);
	const reload = useCallback(() => setVersion((v) => v + 1), []);

	useEffect(() => {
		const timer = setInterval(() => document.visibilityState === "visible" && reload(), LIST_POLL_MS);
		return () => clearInterval(timer);
	}, [reload]);

	// ?user=<id> opens the existing conversation with that person, or a blank one to start
	const userParam = Number(params.get("user")) || null;
	useEffect(() => {
		if (!client || !userParam) return;
		client.findConversation(userParam).then((id) => setSelection(id ? { conversationId: id } : { contact: { id: userParam, fullName: "New message" } }));
	}, [client, userParam]);

	async function messagePerson(person: MoodleContact) {
		const existing = await client?.findConversation(person.id);
		setSelection(existing ? { conversationId: existing } : { contact: person });
		setTab("chats");
	}

	const list = conversations.data ?? [];
	const selected = selection && "conversationId" in selection ? list.find((c) => c.id === selection.conversationId) : undefined;
	const draft = selection && "contact" in selection ? selection.contact : undefined;
	const showThread = Boolean(selected || draft);
	const meId = me.data?.id ?? 0;

	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="Messages" description="Chat with classmates and teachers." />
			<div className="grid h-[calc(100dvh-16rem)] min-h-96 overflow-hidden rounded-xl border bg-card md:grid-cols-[20rem_minmax(0,1fr)]">
				<div className={cn("flex min-h-0 flex-col border-r", showThread && "hidden md:flex")}>
					<div className="border-b p-2">
						<Tabs value={tab} onValueChange={(v) => setTab(v as "chats" | "people")}>
							<TabsList className="w-full">
								<TabsTrigger value="chats">Chats</TabsTrigger>
								<TabsTrigger value="people">People</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">
						{tab === "people" ? (
							<PeoplePanel onMessage={messagePerson} />
						) : (
							<>
								{conversations.loading && <div className="p-3"><ListSkeleton rows={4} /></div>}
								{conversations.error && <ErrorState error={conversations.error} onRetry={refresh} />}
								{conversations.data && list.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted-foreground">No conversations yet. Find someone in People.</p>}
								<ConversationList conversations={list} meId={meId} selectedId={selected?.id ?? null} onSelect={(id) => setSelection({ conversationId: id })} />
							</>
						)}
					</div>
				</div>
				<div className={cn("flex min-h-0 flex-col", !showThread && "hidden md:flex")}>
					{showThread ? (
						<MessageThread
							key={selected?.id ?? `new-${draft?.id}`}
							meId={meId}
							conversation={selected}
							newContact={draft}
							onBack={() => { setSelection(null); reload(); }}
							onChanged={reload}
							onStarted={(id) => { setSelection({ conversationId: id }); reload(); }}
						/>
					) : (
						<div className="m-auto p-6">
							<EmptyState icon={MessageSquare} title="Select a conversation" description="Pick a chat on the left, or search People to start a new one." />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default function MessagesPage() {
	return (
		<FeatureGate feature="Messages" functions={["core_message_get_conversations"]}>
			<Suspense fallback={<ListSkeleton rows={4} />}>
				<MessagesContent />
			</Suspense>
		</FeatureGate>
	);
}
