"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useActivity } from "@/hooks/use-activity";
import { PageHeader } from "@/components/layout/page-header";
import { RichContent } from "@/components/content/rich-content";
import { LiveChat } from "@/components/chat/chat-room";
import { ChatSessions } from "@/components/chat/chat-sessions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeatureGate, ListSkeleton } from "@/components/ui/state";

function ChatContent({ chatId }: { chatId: number }) {
	const courseId = Number(useSearchParams().get("course")) || null;
	const { activity } = useActivity(courseId, "chat", chatId);
	const [tab, setTab] = useState<"live" | "past">("live");

	return (
		<div className="flex flex-col gap-6">
			<Link href={courseId ? `/courses/${courseId}` : "/courses"} className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				Back to course
			</Link>
			<PageHeader title={activity?.name ?? "Chat"} />
			{activity?.description && <RichContent html={activity.description} className="rounded-xl border bg-card p-4" />}
			<Tabs value={tab} onValueChange={(v) => setTab(v as "live" | "past")}>
				<TabsList>
					<TabsTrigger value="live">Live room</TabsTrigger>
					<TabsTrigger value="past">Past sessions</TabsTrigger>
				</TabsList>
			</Tabs>
			{/* the live room unmounts on the other tab so it stops polling and leaves the room's session */}
			{tab === "live" ? <LiveChat chatId={chatId} /> : <ChatSessions chatId={chatId} />}
		</div>
	);
}

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
	const { chatId } = use(params);
	return (
		<FeatureGate feature="Chat" functions={["mod_chat_login_user", "mod_chat_get_chat_latest_messages"]}>
			<Suspense fallback={<ListSkeleton rows={4} />}>
				<ChatContent chatId={Number(chatId)} />
			</Suspense>
		</FeatureGate>
	);
}
