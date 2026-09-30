import { describe, expect, it } from "vitest";
import { modulePath, parseMoodleLink } from "./links";
import { chatMessageText, normalizeChatSessions, normalizeMeetingInfo, normalizeRecordings } from "./normalize-chat";
import {
	normalizeConversations,
	normalizeConversationThread,
	normalizeNotificationPreferences,
	normalizePeopleSearch,
	preferenceWrites,
	stripHtml,
} from "./normalize-messaging";

describe("messaging", () => {
	it("maps conversations with members and last message", () => {
		const [c] = normalizeConversations({
			conversations: [{ id: 5, name: "Ana", type: 1, ismuted: true, isfavourite: true, unreadcount: 2, members: [{ id: 2, fullname: "Ana", isonline: true }], messages: [{ id: 9, useridfrom: 2, text: "<p>hi</p>", timecreated: 100 }] }],
		});
		expect(c).toMatchObject({ id: 5, type: 1, muted: true, favourite: true, unread: 2 });
		expect(c.members[0]).toMatchObject({ id: 2, fullName: "Ana", isOnline: true });
		expect(stripHtml(c.lastMessage!.text)).toBe("hi");
	});

	it("shows a thread oldest first", () => {
		const t = normalizeConversationThread({ id: 5, members: [], messages: [{ id: 2, useridfrom: 1, text: "b", timecreated: 20 }, { id: 1, useridfrom: 2, text: "a", timecreated: 10 }] });
		expect(t.messages.map((m) => m.id)).toEqual([1, 2]);
	});

	it("handles both people-search shapes", () => {
		expect(normalizePeopleSearch({ contacts: [{ id: 1, fullname: "A" }], noncontacts: [{ id: 2, fullname: "B" }] })).toMatchObject({ contacts: [{ id: 1, isContact: true }], others: [{ id: 2 }] });
		expect(normalizePeopleSearch([{ id: 3, fullname: "C" }]).others).toHaveLength(1);
	});
});

describe("notification preferences", () => {
	const raw = (proc: object) => ({ preferences: { components: [{ displayname: "Forum", notifications: [{ preferencekey: "message_provider_mod_forum_posts", displayname: "Posts", processors: [{ name: "email", displayname: "Email", ...proc }, { name: "popup", displayname: "Web", enabled: true }] }] }] } });

	it("reads 4.x enabled flags and writes one _enabled list", () => {
		const prefs = normalizeNotificationPreferences(raw({ enabled: false }));
		expect(prefs.legacy).toBe(false);
		expect(preferenceWrites(prefs, "message_provider_mod_forum_posts", "email", true)).toEqual([{ name: "message_provider_mod_forum_posts_enabled", value: "email,popup" }]);
		expect(preferenceWrites(prefs, "message_provider_mod_forum_posts", "popup", false)[0].value).toBe("none");
	});

	it("reads and writes both lists on pre-4.0 sites", () => {
		const prefs = normalizeNotificationPreferences({ preferences: { components: [{ displayname: "F", notifications: [{ preferencekey: "k", displayname: "P", processors: [{ name: "email", displayname: "Email", loggedin: { checked: true }, loggedoff: { checked: true } }] }] }] } });
		expect(prefs.legacy).toBe(true);
		expect(preferenceWrites(prefs, "k", "email", false).map((w) => w.name)).toEqual(["k_loggedin", "k_loggedoff"]);
	});
});

describe("chat and meetings", () => {
	it("words system messages", () => {
		const name = () => "Ana";
		expect(chatMessageText({ id: 1, userId: 2, system: true, text: "enter", time: "" }, name)).toBe("Ana joined");
		expect(chatMessageText({ id: 1, userId: 2, system: false, text: "hello", time: "" }, name)).toBe("hello");
	});

	it("lists sessions newest first", () => {
		expect(normalizeChatSessions({ sessions: [{ sessionstart: 1, sessionend: 2 }, { sessionstart: 5, sessionend: 6, iscomplete: true }] }).map((s) => s.start)).toEqual([5, 1]);
	});

	it("parses recordings from a JSON string or an array", () => {
		const rec = [{ recordID: "r1", meta: { name: "Week 1" }, startTime: 1_700_000_000_000, playbacks: [{ type: "presentation", url: "https://bbb/p" }, { type: "bad", url: "javascript:x" }] }];
		for (const recordings of [JSON.stringify(rec), rec]) {
			const [r] = normalizeRecordings({ recordings });
			expect(r).toMatchObject({ id: "r1", name: "Week 1", playbacks: [{ type: "presentation" }] });
			expect(r.playbacks).toHaveLength(1);
		}
		expect(normalizeRecordings({ recordings: "not json" })).toEqual([]);
	});

	it("combines meeting info with can_join", () => {
		expect(normalizeMeetingInfo({ statusrunning: true, participantcount: 4 }, { can_join: false, message: "Closed" })).toMatchObject({ running: true, participantCount: 4, canJoin: false, message: "Closed" });
	});
});

describe("parseMoodleLink", () => {
	const site = "https://moodle.example.com/moodle";
	it("recognises discussions, modules, courses and messages", () => {
		expect(parseMoodleLink("https://moodle.example.com/moodle/mod/forum/discuss.php?d=12#p3", site)).toEqual({ kind: "discussion", discussionId: 12 });
		expect(parseMoodleLink("https://moodle.example.com/moodle/mod/assign/view.php?id=44", site)).toEqual({ kind: "module", cmid: 44 });
		expect(parseMoodleLink("/course/view.php?id=7", "https://moodle.example.com")).toEqual({ kind: "course", courseId: 7 });
		expect(parseMoodleLink("https://moodle.example.com/moodle/message/index.php?id=3", site)).toEqual({ kind: "messages" });
	});

	it("ignores other hosts and unknown pages", () => {
		expect(parseMoodleLink("https://evil.example/mod/forum/discuss.php?d=1", site)).toBeNull();
		expect(parseMoodleLink("https://moodle.example.com/moodle/user/profile.php?id=1", site)).toBeNull();
		expect(parseMoodleLink("not a url", "also bad")).toBeNull();
	});

	it("maps module types to app routes", () => {
		expect(modulePath("forum", 3, 9)).toBe("/forums/3?course=9");
expect(modulePath("quiz", 3, 9)).toBe("/quizzes/3?course=9");
		expect(modulePath("label", 3, 9)).toBe("/courses/9");
	});
});
