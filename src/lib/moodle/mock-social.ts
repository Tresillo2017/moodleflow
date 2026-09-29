import { preferenceWrites } from "./normalize-messaging";
import { modulePath } from "./links";
import type { SocialApi } from "./client-social";
import type {
	ChatMessage,
	ConversationMessage,
	ForumPost,
	MoodleContact,
	MoodleConversation,
	MoodleForum,
	MoodleForumDiscussion,
	NotificationPreferences,
} from "@/types/moodle";

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const wait = <T>(value: T, ms = 200): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const ME = 1;
const ME_NAME = "Tomas";

const people: MoodleContact[] = [
	{ id: 2, fullName: "Ana Costa", isOnline: true },
	{ id: 3, fullName: "Rui Ferreira", isOnline: false },
	{ id: 4, fullName: "Prof. Silva", isOnline: true },
	{ id: 5, fullName: "Marta Lopes", isOnline: false },
];
const nameOf = (id: number) => (id === ME ? ME_NAME : (people.find((p) => p.id === id)?.fullName ?? `User ${id}`));

// ---- forums ----
const forums: MoodleForum[] = [
	{ id: 1, cmid: 5, courseId: 1, name: "Discussion: Series convergence", type: "general", intro: "<p>Ask and answer questions about convergence tests.</p>", canCreateDiscussions: true, assessed: 1, maxAttachments: 3, maxBytes: 10_485_760 },
	{ id: 2, cmid: 6, courseId: 1, name: "Announcements", type: "news", canCreateDiscussions: false, assessed: 0, maxAttachments: 0 },
];

interface MockDiscussion extends MoodleForumDiscussion {
	forumId: number;
}
let nextId = 1000;
const discussions: MockDiscussion[] = [
	{ id: 2, forumId: 1, subject: "Welcome to the course", author: "Prof. Silva", timeModified: ago(60 * 24 * 20), replies: 0, unread: 0, pinned: true, locked: false, starred: false, subscribed: true, canReply: true, canPin: true, canLock: true, canFavourite: true },
	{ id: 1, forumId: 1, subject: "Does the ratio test always work?", author: "Ana Costa", timeModified: ago(60 * 24), replies: 2, unread: 1, pinned: false, locked: false, starred: false, subscribed: false, canReply: true, canPin: true, canLock: true, canFavourite: true },
	{ id: 3, forumId: 2, subject: "Midterm moved to Friday", author: "Prof. Silva", timeModified: ago(60 * 5), replies: 0, unread: 0, pinned: false, locked: true, starred: false, subscribed: true, canReply: false, canPin: false, canLock: false, canFavourite: true },
];
for (let i = 0; i < 24; i++) {
	discussions.push({ id: 100 + i, forumId: 1, subject: `Study group ${i + 1}: chapter ${(i % 8) + 1}`, author: people[i % 3].fullName, timeModified: ago(60 * 24 * (2 + i)), replies: i % 4, unread: 0, pinned: false, locked: false, starred: false, subscribed: false, canReply: true, canPin: true, canLock: true, canFavourite: true });
}

const post = (id: number, discussionId: number, parentId: number, authorId: number, subject: string, message: string, minutesAgo: number, extra: Partial<ForumPost> = {}): ForumPost => ({
	id, discussionId, parentId, subject, message, authorId, author: nameOf(authorId), timeCreated: ago(minutesAgo), unread: false, deleted: false, privateReply: false,
	attachments: [], canReply: true, canEdit: authorId === ME, canDelete: authorId === ME,
	rating: { scaleId: 5, options: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })), canRate: authorId !== ME, count: 0 },
	...extra,
});
const threads = new Map<number, ForumPost[]>([
	[1, [
		post(11, 1, 0, 2, "Does the ratio test always work?", "<p>When the limit equals <strong>1</strong> I never know what to do. Is there a rule of thumb?</p>", 60 * 24, {
			attachments: [{ name: "attempt.pdf", url: "data:text/plain,attempt", size: 24_000, mimeType: "application/pdf" }],
		}),
		post(12, 1, 11, 4, "Re: Does the ratio test always work?", "<p>No. It's <em>inconclusive</em> at 1: try comparison or the integral test.</p>", 60 * 20),
		post(13, 1, 12, 3, "Re: Does the ratio test always work?", "<p>Thanks, the integral test worked for me.</p>", 60 * 3, { unread: true }),
	]],
	[2, [post(21, 2, 0, 4, "Welcome to the course", "<p>Introduce yourself below.</p>", 60 * 24 * 20)]],
	[3, [post(31, 3, 0, 4, "Midterm moved to Friday", "<p>Same room, same time.</p>", 60 * 5, { canReply: false, rating: undefined })]],
]);

function threadFor(discussionId: number): ForumPost[] {
	const existing = threads.get(discussionId);
	if (existing) return existing;
	const d = discussions.find((x) => x.id === discussionId);
	return [post(discussionId * 10, discussionId, 0, 2, d?.subject ?? "", "<p>Anyone want to meet on Thursday?</p>", 60 * 24 * 3)];
}

// ---- messaging ----
const messages = new Map<number, ConversationMessage[]>([
	[10, [
		{ id: 1, fromUserId: 2, text: "Hey, did you finish problem 3?", time: ago(90) },
		{ id: 2, fromUserId: ME, text: "Almost, stuck on the last integral.", time: ago(80) },
		{ id: 3, fromUserId: 2, text: "Use integration by parts twice.", time: ago(5) },
	]],
	[11, [{ id: 4, fromUserId: 4, text: "Office hours are Tuesday 14:00.", time: ago(60 * 26) }]],
	[12, [{ id: 5, fromUserId: 3, text: "Study group tonight?", time: ago(60 * 3) }, { id: 6, fromUserId: 5, text: "I'm in!", time: ago(60 * 2) }]],
	[13, [{ id: 7, fromUserId: ME, text: "Note to self: revise chapter 4", time: ago(60 * 48) }]],
]);
const conversations: MoodleConversation[] = [
	{ id: 10, name: "Ana Costa", type: 1, memberCount: 2, muted: false, favourite: true, unread: 1, members: [people[0], { id: ME, fullName: ME_NAME }], canDeleteForAll: false },
	{ id: 11, name: "Prof. Silva", type: 1, memberCount: 2, muted: false, favourite: false, unread: 0, members: [people[2], { id: ME, fullName: ME_NAME }], canDeleteForAll: false },
	{ id: 12, name: "Group A", type: 2, memberCount: 3, muted: true, favourite: false, unread: 2, members: [people[1], people[3], { id: ME, fullName: ME_NAME }], canDeleteForAll: false },
	{ id: 13, name: "Personal space", type: 3, memberCount: 1, muted: false, favourite: false, unread: 0, members: [{ id: ME, fullName: ME_NAME }], canDeleteForAll: false },
];
const contacts = new Set([2, 4]);
const requests = new Set([5]);
const blocked = new Set<number>();

const withLast = (c: MoodleConversation): MoodleConversation => ({ ...c, lastMessage: messages.get(c.id)?.at(-1) });
const person = (id: number): MoodleContact => ({ ...(people.find((p) => p.id === id) as MoodleContact), isContact: contacts.has(id), isBlocked: blocked.has(id) });

// ---- notification preferences ----
const channel = (name: string, label: string, enabled: boolean) => ({ name, label, enabled, locked: false });
const prefs: NotificationPreferences = {
	legacy: false,
	rows: [
		{ key: "message_provider_moodle_instantmessage", label: "Personal messages", component: "System", channels: [channel("email", "Email", false), channel("popup", "Web", true)] },
		{ key: "message_provider_mod_forum_posts", label: "Subscribed forum posts", component: "Forum", channels: [channel("email", "Email", true), channel("popup", "Web", true)] },
		{ key: "message_provider_mod_assign_assign_notification", label: "Assignment notifications", component: "Assignment", channels: [channel("email", "Email", true), channel("popup", "Web", true)] },
	],
};

// ---- chat ----
const chatLog: ChatMessage[] = [
	{ id: 1, userId: 2, system: true, text: "enter", time: ago(20) },
	{ id: 2, userId: 2, system: false, text: "Anyone here to review chapter 4?", time: ago(19) },
	{ id: 3, userId: 4, system: false, text: "I'll join in ten minutes.", time: ago(15) },
];

// ---- meetings ----
let meetingRunning = false;

export function createMockSocialApi(): SocialApi {
	return {
		getForums: (courseId) => wait(forums.filter((f) => f.courseId === courseId)),
		getForumDiscussions: (forumId, page = 0) => wait(discussions.filter((d) => d.forumId === forumId).slice(page * 20, page * 20 + 20).map((d) => ({ ...d }))),
		getForumThread: (discussionId) => {
			const d = discussions.find((x) => x.id === discussionId);
			return wait({ discussionId, forumId: d?.forumId ?? 1, courseId: 1, posts: threadFor(discussionId).map((p) => ({ ...p })) });
		},
		viewDiscussion: () => wait(undefined, 0),
		addForumDiscussion: (forumId, input) => {
			const id = nextId++;
			discussions.unshift({ id, forumId, subject: input.subject, author: ME_NAME, timeModified: new Date().toISOString(), replies: 0, unread: 0, pinned: false, locked: false, starred: false, subscribed: true, canReply: true, canPin: true, canLock: true, canFavourite: true });
			threads.set(id, [post(nextId++, id, 0, ME, input.subject, input.message, 0)]);
			return wait(id);
		},
		replyToPost: (postId, input) => {
			for (const [discussionId, posts] of threads) {
				if (!posts.some((p) => p.id === postId)) continue;
				posts.push(post(nextId++, discussionId, postId, ME, input.subject, input.message, 0, { attachments: (input.files ?? []).map((f) => ({ name: f.name, url: "data:text/plain,", size: f.size, mimeType: f.type })) }));
				const d = discussions.find((x) => x.id === discussionId);
				if (d) d.replies += 1;
			}
			return wait(undefined);
		},
		updatePost: (postId, input) => {
			for (const posts of threads.values()) {
				const i = posts.findIndex((p) => p.id === postId);
				if (i >= 0) posts[i] = { ...posts[i], subject: input.subject, message: input.message };
			}
			return wait(undefined);
		},
		deletePost: (postId) => {
			for (const [id, posts] of threads) {
				threads.set(id, posts.filter((p) => p.id !== postId && p.parentId !== postId));
			}
			return wait(undefined);
		},
		setDiscussionState: (discussionId, _forumId, toggle, value) => {
			const d = discussions.find((x) => x.id === discussionId);
			if (d) {
				if (toggle === "subscribe") d.subscribed = value;
				if (toggle === "favourite") d.starred = value;
				if (toggle === "pin") d.pinned = value;
				if (toggle === "lock") d.locked = value;
			}
			return wait(undefined);
		},
		ratePost: (target, rating) => {
			for (const posts of threads.values()) {
				const p = posts.find((x) => x.id === target.postId);
				if (p?.rating) p.rating = { ...p.rating, mine: rating, count: Math.max(p.rating.count, 1), aggregate: String(rating) };
			}
			return wait(undefined);
		},

		getConversations: () => wait(conversations.map(withLast)),
		getConversationThread: (id) => wait({ id, members: conversations.find((c) => c.id === id)?.members ?? [], messages: [...(messages.get(id) ?? [])] }),
		sendConversationMessage: (id, text) => {
			messages.set(id, [...(messages.get(id) ?? []), { id: nextId++, fromUserId: ME, text, time: new Date().toISOString() }]);
			return wait(undefined, 100);
		},
		markConversationRead: (id) => {
			const c = conversations.find((x) => x.id === id);
			if (c) c.unread = 0;
			return wait(undefined, 50);
		},
		getUnreadMessageCount: () => wait(conversations.filter((c) => !c.muted).reduce((n, c) => n + c.unread, 0), 50),
		findConversation: (userId) => wait(conversations.find((c) => c.type === 1 && c.members.some((m) => m.id === userId))?.id ?? null, 50),
		startConversation: (userId, text) => {
			const id = nextId++;
			conversations.unshift({ id, name: nameOf(userId), type: 1, memberCount: 2, muted: false, favourite: false, unread: 0, members: [person(userId), { id: ME, fullName: ME_NAME }], canDeleteForAll: false });
			messages.set(id, [{ id: nextId++, fromUserId: ME, text, time: new Date().toISOString() }]);
			return wait(id);
		},
		searchPeople: (text) => {
			const q = text.toLowerCase();
			const found = people.filter((p) => p.fullName.toLowerCase().includes(q)).map((p) => person(p.id));
			return wait({ contacts: found.filter((p) => p.isContact), others: found.filter((p) => !p.isContact) });
		},
		getContacts: () => wait([...contacts].map(person)),
		getContactRequests: () => wait([...requests].map(person)),
		getBlockedUsers: () => wait([...blocked].map(person)),
		requestContact: (id) => { requests.add(id); return wait(undefined); },
		confirmContactRequest: (id) => { requests.delete(id); contacts.add(id); return wait(undefined); },
		declineContactRequest: (id) => { requests.delete(id); return wait(undefined); },
		removeContact: (id) => { contacts.delete(id); return wait(undefined); },
		blockUser: (id) => { blocked.add(id); contacts.delete(id); return wait(undefined); },
		unblockUser: (id) => { blocked.delete(id); return wait(undefined); },
		setConversationMuted: (id, muted) => { const c = conversations.find((x) => x.id === id); if (c) c.muted = muted; return wait(undefined, 80); },
		setConversationFavourite: (id, fav) => { const c = conversations.find((x) => x.id === id); if (c) c.favourite = fav; return wait(undefined, 80); },
		deleteConversation: (id) => { messages.delete(id); const i = conversations.findIndex((x) => x.id === id); if (i >= 0) conversations.splice(i, 1); return wait(undefined, 80); },
		deleteMessage: (messageId) => {
			for (const [id, list] of messages) messages.set(id, list.filter((m) => m.id !== messageId));
			return wait(undefined, 80);
		},

		getNotificationPreferences: () => wait({ ...prefs, rows: prefs.rows.map((r) => ({ ...r, channels: r.channels.map((c) => ({ ...c })) })) }),
		setNotificationPreference: (current, key, channelName, enabled) => {
			const writes = preferenceWrites(current, key, channelName, enabled);
			const row = prefs.rows.find((r) => r.key === key);
			const target = row?.channels.find((c) => c.name === channelName);
			if (target && writes.length) target.enabled = enabled;
			return wait(undefined, 80);
		},
		resolveModuleRoute: (cmid) => wait(cmid === 1101 ? modulePath("assign", 101, 1) : cmid === 5 ? modulePath("forum", 1, 1) : null, 50),

		joinChat: () => wait({ sid: "demo" }),
		pollChat: (_room, since) => {
			// a classmate answers when the demo user has written something
			const fresh = chatLog.filter((m) => new Date(m.time).getTime() / 1000 > since);
			return wait({ messages: fresh, lastTime: Math.floor(Date.now() / 1000) }, 100);
		},
		sendChatMessage: (_room, text) => {
			chatLog.push({ id: nextId++, userId: ME, system: false, text, time: new Date().toISOString() });
			setTimeout(() => chatLog.push({ id: nextId++, userId: 2, system: false, text: "Nice, thanks!", time: new Date().toISOString() }), 2500);
			return wait(undefined, 80);
		},
		getChatUsers: () => wait([people[0], people[2], { id: ME, fullName: ME_NAME }]),
		getChatSessions: () => wait([{ start: Math.floor((now - 2 * 86_400_000) / 1000), end: Math.floor((now - 2 * 86_400_000 + 1_800_000) / 1000), complete: true, users: [{ userId: 2, messageCount: 4 }, { userId: 4, messageCount: 2 }] }]),
		getChatSessionMessages: () => wait(chatLog.slice(0, 3).map((m) => ({ ...m, time: ago(60 * 48) }))),

		getMeetingInfo: () => wait({ running: meetingRunning, participantCount: meetingRunning ? 3 : 0, canJoin: true, openingTime: undefined }),
		getMeetingJoinUrl: () => { meetingRunning = true; return wait("https://example.com/bbb-demo"); },
		getMeetingRecordings: () => wait([{ id: "r1", name: "Week 1: Introduction", date: ago(60 * 24 * 9), playbacks: [{ type: "presentation", url: "https://example.com/recording/1" }] }]),
	};
}
