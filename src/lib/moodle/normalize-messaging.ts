import type {
	ConversationMessage,
	ConversationThread,
	MoodleContact,
	MoodleConversation,
	NotificationPreferences,
	PeopleSearchResult,
} from "@/types/moodle";
import { asArray, asRecord } from "./normalize";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const iso = (seconds: unknown) => new Date(Number(seconds ?? 0) * 1000).toISOString();

/** Moodle sends message text as HTML; used for list previews. */
export function stripHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

export function normalizeContact(raw: unknown): MoodleContact {
	const r = asRecord(raw);
	return {
		id: Number(r.id),
		fullName: String(r.fullname ?? ""),
		imageUrl: str(r.profileimageurl) ?? str(r.profileimageurlsmall),
		isOnline: r.isonline === undefined || r.isonline === null ? undefined : Boolean(r.isonline),
		isBlocked: r.isblocked === undefined ? undefined : Boolean(r.isblocked),
		isContact: r.iscontact === undefined ? undefined : Boolean(r.iscontact),
	};
}

export const normalizeContacts = (raw: unknown): MoodleContact[] => asArray(raw).map(normalizeContact);

function normalizeMessage(raw: unknown): ConversationMessage {
	const r = asRecord(raw);
	return { id: Number(r.id), fromUserId: Number(r.useridfrom ?? 0), text: String(r.text ?? ""), time: iso(r.timecreated) };
}

// core_message_get_conversations
export function normalizeConversations(raw: unknown): MoodleConversation[] {
	return asArray(asRecord(raw).conversations).map((c) => {
		const r = asRecord(c);
		const type = Number(r.type);
		const last = asArray(r.messages)[0];
		return {
			id: Number(r.id),
			name: String(r.name ?? ""),
			imageUrl: str(r.imageurl),
			type: type === 2 || type === 3 ? type : 1,
			memberCount: Number(r.membercount ?? 0),
			muted: Boolean(r.ismuted),
			favourite: Boolean(r.isfavourite),
			unread: Number(r.unreadcount ?? 0),
			members: normalizeContacts(r.members),
			lastMessage: last ? normalizeMessage(last) : undefined,
			canDeleteForAll: Boolean(r.candeletemessagesforallusers),
		};
	});
}

// core_message_get_conversation_messages (Moodle returns the newest page; show oldest first)
export function normalizeConversationThread(raw: unknown): ConversationThread {
	const r = asRecord(raw);
	const messages = asArray(r.messages).map(normalizeMessage).sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id);
	return { id: Number(r.id), members: normalizeContacts(r.members), messages };
}

// core_message_message_search_users / core_message_search_contacts
export function normalizePeopleSearch(raw: unknown): PeopleSearchResult {
	if (Array.isArray(raw)) return { contacts: [], others: normalizeContacts(raw) };
	const r = asRecord(raw);
	return { contacts: normalizeContacts(r.contacts).map((c) => ({ ...c, isContact: true })), others: normalizeContacts(r.noncontacts) };
}

// core_message_get_user_notification_preferences
export function normalizeNotificationPreferences(raw: unknown): NotificationPreferences {
	const prefs = asRecord(asRecord(raw).preferences);
	let legacy = false;
	const rows = asArray(prefs.components).flatMap((c) => {
		const component = asRecord(c);
		return asArray(component.notifications).map((n) => {
			const note = asRecord(n);
			const channels = asArray(note.processors).map((p) => {
				const proc = asRecord(p);
				if (proc.enabled === undefined && proc.loggedin !== undefined) legacy = true;
				const loggedIn = proc.loggedin as { checked?: boolean } | undefined;
				const loggedOff = proc.loggedoff as { checked?: boolean } | undefined;
				return {
					name: String(proc.name ?? ""),
					label: String(proc.displayname ?? proc.name ?? ""),
					enabled: Boolean(proc.enabled ?? loggedIn?.checked ?? loggedOff?.checked),
					locked: Boolean(proc.locked),
				};
			});
			return {
				key: String(note.preferencekey ?? ""),
				label: String(note.displayname ?? note.name ?? ""),
				component: String(component.displayname ?? ""),
				channels,
			};
		});
	}).filter((row) => row.key && row.channels.length);
	return { rows, legacy };
}

/** The user preference writes (core_user_update_user_preferences) that persist one channel toggle. */
export function preferenceWrites(
	prefs: NotificationPreferences,
	key: string,
	channel: string,
	enabled: boolean,
): { name: string; value: string }[] {
	const row = prefs.rows.find((r) => r.key === key);
	if (!row) return [];
	const active = row.channels.filter((c) => (c.name === channel ? enabled : c.enabled)).map((c) => c.name).join(",");
	// pre-4.0 sites keep separate logged-in and logged-off lists; we set both to the same channels
	const suffixes = prefs.legacy ? ["loggedin", "loggedoff"] : ["enabled"];
	return suffixes.map((s) => ({ name: `${key}_${s}`, value: active || "none" }));
}
