import { describe, expect, it } from "vitest";
import { normalizeForumDiscussions, normalizeForums, normalizeForumThread, threadOrder } from "./normalize-forum";

describe("normalizeForums", () => {
	it("maps the fields the UI needs", () => {
		const [f] = normalizeForums([{ id: 3, cmid: 30, course: 2, name: "News", type: "news", cancreatediscussions: false, assessed: 1, maxattachments: 5, maxbytes: 1000 }]);
		expect(f).toMatchObject({ id: 3, cmid: 30, courseId: 2, type: "news", canCreateDiscussions: false, assessed: 1, maxAttachments: 5, maxBytes: 1000 });
	});
});

describe("normalizeForumDiscussions", () => {
	it("maps discussions and tolerates an empty response", () => {
		const [d] = normalizeForumDiscussions({
			discussions: [{ discussion: 9, subject: "Hi", userfullname: "Ana", timemodified: 1_700_000_000, numreplies: 3, numunread: 1, pinned: true, canlock: true, starred: true }],
		});
		expect(d).toMatchObject({ id: 9, subject: "Hi", author: "Ana", replies: 3, unread: 1, pinned: true, starred: true, canLock: true, canPin: true, canReply: true, locked: false });
		expect(normalizeForumDiscussions({})).toEqual([]);
	});
});

describe("normalizeForumThread", () => {
	const raw = {
		forumid: 4,
		courseid: 2,
		ratinginfo: {
			scales: [{ id: 5, max: 3 }],
			ratings: [{ itemid: 11, scaleid: 5, canrate: true, rating: "2", aggregatestr: "2.5", count: 2 }],
		},
		posts: [
			{ id: 11, discussionid: 9, parentid: null, subject: "Q", message: "<p>x</p>", author: { id: 7, fullname: "Ana", urls: { profileimage: "https://m/p.png" } }, timecreated: 100,
				capabilities: { reply: true, edit: true, delete: false }, attachments: [{ filename: "a.pdf", fileurl: "https://m/a.pdf", filesize: 3, mimetype: "application/pdf" }] },
			{ id: 12, discussionid: 9, parentid: 11, subject: "Re: Q", message: "y", author: { id: 8, fullname: "Rui" }, timecreated: 200 },
		],
	};

	it("maps posts, capabilities, attachments and ratings", () => {
		const t = normalizeForumThread(raw, 9);
		expect(t).toMatchObject({ forumId: 4, courseId: 2 });
		expect(t.posts[0]).toMatchObject({ parentId: 0, authorId: 7, canReply: true, canEdit: true, canDelete: false, authorImageUrl: "https://m/p.png" });
		expect(t.posts[0].attachments[0]).toMatchObject({ name: "a.pdf", size: 3 });
		expect(t.posts[0].rating).toMatchObject({ scaleId: 5, canRate: true, mine: 2, aggregate: "2.5", options: [{ value: 1 }, { value: 2 }, { value: 3 }] });
		expect(t.posts[1].rating).toBeUndefined();
	});

	it("orders replies under their parent and keeps orphans as roots", () => {
		const t = normalizeForumThread(raw, 9);
		const withOrphan = [...t.posts, { ...t.posts[1], id: 13, parentId: 999, timeCreated: "1970-01-01T00:05:00.000Z" }, { ...t.posts[1], id: 14, parentId: 11, timeCreated: "1970-01-01T00:04:00.000Z" }];
		expect(threadOrder(withOrphan).map((n) => [n.post.id, n.depth])).toEqual([[11, 0], [12, 1], [14, 1], [13, 0]]);
	});
});
