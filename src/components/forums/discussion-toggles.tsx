"use client";

import { useState } from "react";
import { Bell, BellOff, Lock, LockOpen, Pin, PinOff, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { toast } from "@/lib/toast";
import type { DiscussionToggle } from "@/lib/moodle/client-social";
import type { MoodleForumDiscussion } from "@/types/moodle";

interface Toggle {
	kind: DiscussionToggle;
	label: (on: boolean) => string;
	icon: (on: boolean) => React.ComponentType<{ className?: string }>;
	on: (d: MoodleForumDiscussion) => boolean;
	allowed: (d: MoodleForumDiscussion) => boolean;
}

const TOGGLES: Toggle[] = [
	{ kind: "subscribe", label: (on) => (on ? "Unsubscribe from replies" : "Subscribe to replies"), icon: (on) => (on ? Bell : BellOff), on: (d) => d.subscribed, allowed: () => true },
	{ kind: "favourite", label: (on) => (on ? "Remove star" : "Star discussion"), icon: () => Star, on: (d) => d.starred, allowed: (d) => d.canFavourite },
	{ kind: "pin", label: (on) => (on ? "Unpin" : "Pin to top"), icon: (on) => (on ? PinOff : Pin), on: (d) => d.pinned, allowed: (d) => d.canPin },
	{ kind: "lock", label: (on) => (on ? "Unlock replies" : "Lock replies"), icon: (on) => (on ? LockOpen : Lock), on: (d) => d.locked, allowed: (d) => d.canLock },
];

/** Per-discussion subscribe / star / pin / lock; updates optimistically and rolls back if Moodle refuses. */
export function DiscussionToggles({ discussion, forumId, onChange }: { discussion: MoodleForumDiscussion; forumId: number; onChange: (next: MoodleForumDiscussion) => void }) {
	const { client } = useMoodleConnection();
	const [busy, setBusy] = useState<DiscussionToggle | null>(null);

	async function toggle(t: Toggle) {
		if (!client || busy) return;
		const value = !t.on(discussion);
		const patch = { subscribe: "subscribed", favourite: "starred", pin: "pinned", lock: "locked" } as const;
		onChange({ ...discussion, [patch[t.kind]]: value });
		setBusy(t.kind);
		try {
			await client.setDiscussionState(discussion.id, forumId, t.kind, value);
		} catch {
			onChange(discussion);
			toast.error("Couldn't update the discussion.");
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className="flex items-center" role="group" aria-label="Discussion options">
			{TOGGLES.filter((t) => t.allowed(discussion)).map((t) => {
				const on = t.on(discussion);
				const Icon = t.icon(on);
				return (
					<Button key={t.kind} variant="ghost" size="icon-sm" aria-pressed={on} aria-label={t.label(on)} title={t.label(on)} disabled={busy === t.kind} onClick={() => void toggle(t)}>
						<Icon className={on && t.kind !== "subscribe" ? "fill-current" : undefined} />
					</Button>
				);
			})}
		</div>
	);
}
