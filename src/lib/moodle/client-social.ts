import { MoodleError } from "@/types/moodle";
import { callMoodle, type MoodleConnection, type MoodleParams } from "./call";
import {
	normalizeForums,
	normalizeForumDiscussions,
	normalizeForumThread,
} from "./normalize-forum";
import {
	normalizeContacts,
	normalizeConversations,
	normalizeConversationThread,
	normalizeNotificationPreferences,
	normalizePeopleSearch,
	preferenceWrites,
} from "./normalize-messaging";
import {
	normalizeChatMessages,
	normalizeChatPoll,
	normalizeChatSessions,
	normalizeMeetingInfo,
	normalizeRecordings,
} from "./normalize-chat";
import { asArray, asRecord, normalizeParticipants } from "./normalize";
import { modulePath } from "./links";
import type {
	ChatMessage,
	ChatPoll,
	ChatRoom,
	ChatSession,
	ConversationThread,
	ForumPostInput,
	ForumThread,
	MeetingInfo,
	MeetingRecording,
	MoodleContact,
	MoodleConversation,
	MoodleForum,
	MoodleForumDiscussion,
	NotificationPreferences,
	PeopleSearchResult,
} from "@/types/moodle";

export const FORUM_PAGE_SIZE = 20;
export const THREAD_PAGE_SIZE = 50;

export type DiscussionToggle = "subscribe" | "favourite" | "pin" | "lock";

export interface RatingTarget {
	cmid: number;
	postId: number;
	authorId: number;
	scaleId: number;
	/** Forum's `assessed` aggregate type. */
	aggregation: number;
}

/** Forums, messaging, notification preferences, chat and BigBlueButton. */
export interface SocialApi {
	getForums(courseId: number): Promise<MoodleForum[]>;
	/** One page of discussions (pinned first); a full page means there may be more. */
	getForumDiscussions(forumId: number, page?: number): Promise<MoodleForumDiscussion[]>;
	getForumThread(discussionId: number): Promise<ForumThread>;
	/** Tells Moodle the discussion was opened (marks its posts read). Best effort. */
	viewDiscussion(discussionId: number): Promise<void>;
	addForumDiscussion(forumId: number, input: ForumPostInput): Promise<number>;
	replyToPost(postId: number, input: ForumPostInput): Promise<void>;
	updatePost(postId: number, input: Pick<ForumPostInput, "subject" | "message">): Promise<void>;
	deletePost(postId: number): Promise<void>;
	setDiscussionState(discussionId: number, forumId: number, toggle: DiscussionToggle, value: boolean): Promise<void>;
	ratePost(target: RatingTarget, rating: number): Promise<void>;

	getConversations(): Promise<MoodleConversation[]>;
	getConversationThread(conversationId: number): Promise<ConversationThread>;
	sendConversationMessage(conversationId: number, text: string): Promise<void>;
	markConversationRead(conversationId: number): Promise<void>;
	getUnreadMessageCount(): Promise<number>;
	/** Existing private conversation with this person, or null. */
	findConversation(userId: number): Promise<number | null>;
	/** Sends the first message (Moodle creates the conversation) and returns its id. */
	startConversation(userId: number, text: string): Promise<number>;
	searchPeople(text: string): Promise<PeopleSearchResult>;
	getContacts(): Promise<MoodleContact[]>;
	getContactRequests(): Promise<MoodleContact[]>;
	getBlockedUsers(): Promise<MoodleContact[]>;
	requestContact(userId: number): Promise<void>;
	confirmContactRequest(userId: number): Promise<void>;
	declineContactRequest(userId: number): Promise<void>;
	removeContact(userId: number): Promise<void>;
	blockUser(userId: number): Promise<void>;
	unblockUser(userId: number): Promise<void>;
	setConversationMuted(conversationId: number, muted: boolean): Promise<void>;
	setConversationFavourite(conversationId: number, favourite: boolean): Promise<void>;
	deleteConversation(conversationId: number): Promise<void>;
	deleteMessage(messageId: number, forEveryone: boolean): Promise<void>;

	getNotificationPreferences(): Promise<NotificationPreferences>;
	setNotificationPreference(prefs: NotificationPreferences, key: string, channel: string, enabled: boolean): Promise<void>;
	/** In-app route for a course module (from a Moodle notification link). */
	resolveModuleRoute(cmid: number): Promise<string | null>;

	joinChat(chatId: number): Promise<ChatRoom>;
	pollChat(room: ChatRoom, sinceTime: number): Promise<ChatPoll>;
	sendChatMessage(room: ChatRoom, text: string): Promise<void>;
	getChatUsers(room: ChatRoom): Promise<MoodleContact[]>;
	getChatSessions(chatId: number): Promise<ChatSession[]>;
	getChatSessionMessages(chatId: number, session: Pick<ChatSession, "start" | "end">): Promise<ChatMessage[]>;

	getMeetingInfo(cmid: number, instance: number): Promise<MeetingInfo>;
	getMeetingJoinUrl(cmid: number): Promise<string>;
	getMeetingRecordings(instance: number): Promise<MeetingRecording[]>;
}

export interface SocialContext {
	connection: MoodleConnection;
	userId(): Promise<number>;
	uploadFiles(files: File[]): Promise<number>;
}

const list = (values: number[]): MoodleParams => Object.fromEntries(values.map((v, i) => [i, v]));

export function createSocialApi({ connection, userId, uploadFiles }: SocialContext): SocialApi {
	const get = <T>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params);
	const post = <T = unknown>(fn: string, params: MoodleParams = {}) => callMoodle<T>(connection, fn, params, "POST");
	const withUser = async (fn: string, params: MoodleParams = {}, method: "GET" | "POST" = "POST") =>
		callMoodle(connection, fn, { userid: await userId(), ...params }, method);

	async function postOptions(files?: File[]): Promise<MoodleParams> {
		const options: MoodleParams = { 0: { name: "discussionsubscribe", value: 1 } };
		if (files?.length) options[1] = { name: "attachmentsid", value: await uploadFiles(files) };
		return options;
	}

	const contactCall = (fn: string) => async (otherUserId: number) => {
		await post(fn, { userid: await userId(), requesteduserid: otherUserId });
	};

	async function messageSearch(text: string): Promise<PeopleSearchResult> {
		try {
			return normalizePeopleSearch(await withUser("core_message_message_search_users", { search: text, limitfrom: 0, limitnum: 20 }, "GET"));
		} catch {
			// older sites only have the flat contact search
			return normalizePeopleSearch(await get("core_message_search_contacts", { searchtext: text, onlymycourses: 0 }));
		}
	}

	// Participants of the user's courses, loaded once: Moodle's message search hides people the site policy doesn't expose (often classmates).
	let participants: Promise<MoodleContact[]> | null = null;
	async function classmateSearch(text: string): Promise<MoodleContact[]> {
		participants ??= (async () => {
			const me = await userId();
			const courses = asArray(await get("core_enrol_get_users_courses", { userid: me })).map((c) => Number(asRecord(c).id));
			const lists = await Promise.all(courses.map((id) => get("core_enrol_get_enrolled_users", { courseid: id }).then(normalizeParticipants, () => [])));
			const byId = new Map(lists.flat().filter((p) => p.id !== me).map((p) => [p.id, { id: p.id, fullName: p.fullName, imageUrl: p.imageUrl }]));
			return [...byId.values()];
		})();
		const q = text.toLowerCase();
		return (await participants).filter((p) => p.fullName.toLowerCase().includes(q)).slice(0, 20);
	}

	const DISCUSSION_TOGGLES: Record<DiscussionToggle, string> = {
		subscribe: "mod_forum_set_subscription_state",
		favourite: "mod_forum_toggle_favourite_state",
		pin: "mod_forum_set_pin_state",
		lock: "mod_forum_set_lock_state",
	};

	return {
		async getForums(courseId) {
			return normalizeForums(await get("mod_forum_get_forums_by_courses", { courseids: list([courseId]) }));
		},

		async getForumDiscussions(forumId, page = 0) {
			return normalizeForumDiscussions(
				await get("mod_forum_get_forum_discussions", { forumid: forumId, sortorder: -1, page, perpage: FORUM_PAGE_SIZE }),
			);
		},

		async getForumThread(discussionId) {
			return normalizeForumThread(await get("mod_forum_get_discussion_posts", { discussionid: discussionId, sortby: "created", sortdirection: "ASC" }), discussionId);
		},

		async viewDiscussion(discussionId) {
			await post("mod_forum_view_forum_discussion", { discussionid: discussionId }).catch(() => {});
		},

		async addForumDiscussion(forumId, input) {
			const raw = await post("mod_forum_add_discussion", {
				forumid: forumId,
				subject: input.subject,
				message: input.message,
				options: await postOptions(input.files),
			});
			return Number(asRecord(raw).discussionid ?? 0);
		},

		async replyToPost(postId, input) {
			await post("mod_forum_add_discussion_post", { postid: postId, subject: input.subject, message: input.message, options: await postOptions(input.files) });
		},

		async updatePost(postId, input) {
			await post("mod_forum_update_discussion_post", { postid: postId, subject: input.subject, message: input.message, messageformat: 1 });
		},

		async deletePost(postId) {
			await post("mod_forum_delete_post", { postid: postId });
		},

		async setDiscussionState(discussionId, forumId, toggle, value) {
			const target = value ? 1 : 0;
			// subscribe and lock also need the forum; favourite and pin only the discussion
			const params: MoodleParams =
				toggle === "subscribe" || toggle === "lock"
					? { forumid: forumId, discussionid: discussionId, targetstate: target }
					: { discussionid: discussionId, targetstate: target };
			await post(DISCUSSION_TOGGLES[toggle], params);
		},

		async ratePost(target, rating) {
			await post("core_rating_add_rating", {
				contextlevel: "module",
				instanceid: target.cmid,
				component: "mod_forum",
				ratingarea: "post",
				itemid: target.postId,
				scaleid: target.scaleId,
				rating,
				rateduserid: target.authorId,
				aggregation: target.aggregation,
			});
		},

		async getConversations() {
			return normalizeConversations(await withUser("core_message_get_conversations", { limitfrom: 0, limitnum: 100, mergeself: 1 }, "GET"));
		},

		async getConversationThread(conversationId) {
			const raw = await get("core_message_get_conversation_messages", {
				currentuserid: await userId(),
				convid: conversationId,
				limitfrom: 0,
				limitnum: THREAD_PAGE_SIZE,
				newest: 1,
			});
			return normalizeConversationThread(raw);
		},

		async sendConversationMessage(conversationId, text) {
			await post("core_message_send_messages_to_conversation", { conversationid: conversationId, messages: { 0: { text, textformat: 0 } } });
		},

		async markConversationRead(conversationId) {
			await withUser("core_message_mark_all_conversation_messages_as_read", { conversationid: conversationId });
		},

		async getUnreadMessageCount() {
			try {
				return Number(await get("core_message_get_unread_conversations_count", { useridto: await userId() })) || 0;
			} catch {
				return 0;
			}
		},

		async findConversation(otherUserId) {
			try {
				const raw = await withUser("core_message_get_conversation_between_users", { otheruserid: otherUserId, includecontactrequests: 0, includeprivacyinfo: 0 }, "GET");
				const id = Number(asRecord(raw).id);
				return id > 0 ? id : null;
			} catch {
				return null; // no conversation yet
			}
		},

		async startConversation(otherUserId, text) {
			const raw = await post("core_message_send_instant_messages", { messages: { 0: { touserid: otherUserId, text, textformat: 0 } } });
			const first = asRecord(asArray(raw)[0]);
			if (first.errormessage) throw new Error(String(first.errormessage));
			return Number(first.conversationid ?? 0);
		},

		async searchPeople(text) {
			const [site, classmates] = await Promise.all([
				messageSearch(text).catch(() => null),
				classmateSearch(text).catch(() => []),
			]);
			if (!site && classmates.length === 0) throw new MoodleError("unknown_error", "Moodle couldn't search for people.");
			// the site's search knows who is already a contact; course participants fill in everyone it hides
			const known = new Set([...(site?.contacts ?? []), ...(site?.others ?? [])].map((c) => c.id));
			return { contacts: site?.contacts ?? [], others: [...(site?.others ?? []), ...classmates.filter((c) => !known.has(c.id))] };
		},

		async getContacts() {
			return normalizeContacts(await withUser("core_message_get_user_contacts", { limitfrom: 0, limitnum: 100 }, "GET")).map((c) => ({ ...c, isContact: true }));
		},

		async getContactRequests() {
			return normalizeContacts(await withUser("core_message_get_contact_requests", { limitfrom: 0, limitnum: 50 }, "GET"));
		},

		async getBlockedUsers() {
			return normalizeContacts(asRecord(await withUser("core_message_get_blocked_users", {}, "GET")).users).map((c) => ({ ...c, isBlocked: true }));
		},

		requestContact: contactCall("core_message_create_contact_request"),
		confirmContactRequest: contactCall("core_message_confirm_contact_request"),
		declineContactRequest: contactCall("core_message_decline_contact_request"),

		async removeContact(otherUserId) {
			await post("core_message_delete_contacts", { userid: await userId(), userids: list([otherUserId]) });
		},

		async blockUser(otherUserId) {
			await post("core_message_block_user", { userid: await userId(), blockeduserid: otherUserId });
		},

		async unblockUser(otherUserId) {
			await post("core_message_unblock_user", { userid: await userId(), unblockeduserid: otherUserId });
		},

		async setConversationMuted(conversationId, muted) {
			await withUser(muted ? "core_message_mute_conversations" : "core_message_unmute_conversations", { conversationids: list([conversationId]) });
		},

		async setConversationFavourite(conversationId, favourite) {
			await withUser(favourite ? "core_message_set_favourite_conversations" : "core_message_unset_favourite_conversations", { conversations: list([conversationId]) });
		},

		async deleteConversation(conversationId) {
			await withUser("core_message_delete_conversations_by_id", { conversationids: list([conversationId]) });
		},

		async deleteMessage(messageId, forEveryone) {
			await withUser(forEveryone ? "core_message_delete_message_for_all_users" : "core_message_delete_message", { messageid: messageId, ...(forEveryone ? {} : { read: 1 }) });
		},

		async getNotificationPreferences() {
			return normalizeNotificationPreferences(await withUser("core_message_get_user_notification_preferences", {}, "GET"));
		},

		async setNotificationPreference(prefs, key, channel, enabled) {
			const id = await userId();
			const writes = preferenceWrites(prefs, key, channel, enabled);
			await post("core_user_update_user_preferences", {
				preferences: Object.fromEntries(writes.map((w, i) => [i, { ...w, userid: id }])),
			});
		},

		async resolveModuleRoute(cmid) {
			try {
				const cm = asRecord(asRecord(await get("core_course_get_course_module", { cmid })).cm);
				return modulePath(String(cm.modname ?? ""), Number(cm.instance), Number(cm.course));
			} catch {
				return null;
			}
		},

		async joinChat(chatId) {
			const raw = await post("mod_chat_login_user", { chatid: chatId });
			return { sid: String(asRecord(raw).chatsid) };
		},

		async pollChat(room, sinceTime) {
			return normalizeChatPoll(await post("mod_chat_get_chat_latest_messages", { chatsid: room.sid, chatlasttime: sinceTime }));
		},

		async sendChatMessage(room, text) {
			await post("mod_chat_send_chat_message", { chatsid: room.sid, messagetext: text });
		},

		async getChatUsers(room) {
			return normalizeContacts(asRecord(await post("mod_chat_get_chat_users", { chatsid: room.sid })).users);
		},

		async getChatSessions(chatId) {
			return normalizeChatSessions(await get("mod_chat_get_sessions", { chatid: chatId, groupid: 0, showall: 0 }));
		},

		async getChatSessionMessages(chatId, session) {
			return normalizeChatMessages(await get("mod_chat_get_session_messages", { chatid: chatId, sessionstart: session.start, sessionend: session.end, groupid: 0 }));
		},

		async getMeetingInfo(cmid, instance) {
			const [info, canJoin] = await Promise.all([
				get("mod_bigbluebuttonbn_meeting_info", { bigbluebuttonbnid: instance, groupid: 0 }),
				get("mod_bigbluebuttonbn_can_join", { cmid, groupid: 0 }).catch(() => ({ can_join: true })),
			]);
			return normalizeMeetingInfo(info, canJoin);
		},

		async getMeetingJoinUrl(cmid) {
			const url = asRecord(await get("mod_bigbluebuttonbn_get_join_url", { cmid, groupid: 0 })).join_url;
			if (typeof url !== "string" || !/^https?:\/\//.test(url)) throw new Error("Moodle didn't return a meeting link.");
			return url;
		},

		async getMeetingRecordings(instance) {
			return normalizeRecordings(await get("mod_bigbluebuttonbn_get_recordings", { bigbluebuttonbnid: instance, groupid: 0 }));
		},
	};
}
