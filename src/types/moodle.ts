export interface MoodleSiteInfo {
	siteName: string;
	siteUrl: string;
	userId: number;
	username: string;
	fullName: string;
	userPictureUrl?: string;
	release: string;
	functions: string[];
	/** Largest file this user may upload (bytes); 0/undefined means no site limit. */
	maxUploadBytes?: number;
}

export interface MoodleSiteConfig {
	siteName: string;
	logoUrl?: string;
	maxUploadBytes?: number;
	registrationEnabled: boolean;
	policyUrl?: string;
}

export interface MoodleUser {
	id: number;
	username: string;
	fullName: string;
	email?: string;
	profileImageUrl?: string;
	roles?: string[];
}

export interface MoodleCourse {
	id: number;
	shortName: string;
	fullName: string;
	summary?: string;
	imageUrl?: string;
	progress?: number;
	startDate?: string;
	endDate?: string;
	isFavourite?: boolean;
	visible: boolean;
}

export type ActivityType =
	| "assignment"
	| "quiz"
	| "resource"
	| "page"
	| "forum"
	| "url"
	| "lesson"
	| "feedback"
	| "folder"
	| "label"
	| "book"
	| "imscp"
	| "chat"
	| "bigbluebuttonbn"
	| "workshop"
	| "choice"
	| "survey"
	| "wiki"
	| "glossary"
	| "data"
	| "h5pactivity"
	| "scorm"
	| "lti"
	| "unknown";

export interface MoodleFile {
	name: string;
	url: string;
	size: number;
	mimeType?: string;
	/** Folder-relative directory (folder activities), e.g. "/week1/". */
	path?: string;
}

export interface BookChapter {
	title: string;
	/** Chapter file path relative to the book contents, e.g. "12/index.html". */
	href: string;
	level: number;
}

export interface MoodleActivity {
	id: number;
	/** Module instance id (assignment id, forum id, ...); `id` is the course-module id. */
	instance?: number;
	files?: MoodleFile[];
	courseId: number;
	sectionId: number;
	type: ActivityType;
	name: string;
	description?: string;
	url?: string;
	dueDate?: string;
	completed?: boolean;
	/** Completion is ticked by the student rather than tracked automatically. */
	manualCompletion?: boolean;
	/** URL activities: the external link (`url` is the Moodle page). */
	externalUrl?: string;
	/** Book activities: table of contents. */
	chapters?: BookChapter[];
	/** Restricted for this user; `availabilityInfo` is Moodle's HTML explanation. */
	locked?: boolean;
	availabilityInfo?: string;
	/** Human-readable completion requirements, e.g. "View", "Receive a grade". */
	completionDetails?: string[];
	visible: boolean;
}

export interface MoodleSection {
	id: number;
	name: string;
	summary?: string;
	locked?: boolean;
	availabilityInfo?: string;
	activities: MoodleActivity[];
}

export interface MoodleCourseContent {
	courseId: number;
	sections: MoodleSection[];
}

export type SubmissionStatus =
	| "not_started"
	| "draft"
	| "submitted"
	| "graded"
	| "late"
	| "overdue"
	| "unknown";

export interface AssignmentConfig {
	acceptsText: boolean;
	acceptsFiles: boolean;
	maxFiles?: number;
	maxFileBytes?: number;
	/** Drafts mode: saving is not final until "submit for grading". */
	requiresSubmitAction: boolean;
	requiresStatement: boolean;
}

export interface AssignmentSubmission {
	id?: number;
	status: "new" | "draft" | "submitted" | "reopened";
	timeModified?: string;
	text?: string;
	files: MoodleFile[];
}

export interface MoodleAssignment {
	id: number;
	courseId: number;
	courseName: string;
	name: string;
	/** Assignment intro (Moodle HTML). */
	description?: string;
	introFiles?: MoodleFile[];
	/** Course-module id: comments and completion are addressed by it. */
	cmid?: number;
	openDate?: string;
	dueDate?: string;
	/** Set when an extension moved dueDate; the date Moodle originally set. */
	originalDueDate?: string;
	cutoffDate?: string;
	/** Group assignment: one shared submission for the whole team. */
	isGroup?: boolean;
	status: SubmissionStatus;
	completion?: { done: boolean; label?: string };
	config?: AssignmentConfig;
	submission?: AssignmentSubmission;
	/** Moodle's verdict on whether the current user may add/edit a submission. */
	canEdit?: boolean;
	grade?: number;
	maxGrade?: number;
	gradedDate?: string;
	feedback?: string;
	/** Rubric / marking-guide result: Moodle renders it as HTML in gradefordisplay. */
	gradingDetails?: string;
	feedbackFiles?: MoodleFile[];
}

export interface MoodleComment {
	id: number;
	author: string;
	/** Moodle HTML */
	content: string;
	time: string;
}

export interface MoodleForum {
	id: number;
	/** Course-module id. */
	cmid: number;
	courseId: number;
	name: string;
	/** Moodle forum type: general, news, qanda, single, eachuser, blog. */
	type: string;
	intro?: string;
	canCreateDiscussions: boolean;
	/** Moodle's rating aggregate type (0 = ratings off). */
	assessed: number;
	maxAttachments: number;
	maxBytes?: number;
	unread?: number;
}

export interface MoodleForumDiscussion {
	id: number;
	subject: string;
	author: string;
	authorImageUrl?: string;
	timeModified: string;
	replies: number;
	unread: number;
	pinned: boolean;
	locked: boolean;
	starred: boolean;
	subscribed: boolean;
	canReply: boolean;
	canPin: boolean;
	canLock: boolean;
	canFavourite: boolean;
}

export interface ForumRating {
	scaleId: number;
	/** Selectable values, e.g. 1..5 or a custom scale. */
	options: { value: number; label: string }[];
	canRate: boolean;
	/** Current user's rating. */
	mine?: number;
	aggregate?: string;
	count: number;
}

export interface ForumPost {
	id: number;
	discussionId: number;
	/** 0 for the opening post. */
	parentId: number;
	subject: string;
	/** Moodle HTML */
	message: string;
	authorId: number;
	author: string;
	authorImageUrl?: string;
	timeCreated: string;
	unread: boolean;
	deleted: boolean;
	privateReply: boolean;
	attachments: MoodleFile[];
	canReply: boolean;
	canEdit: boolean;
	canDelete: boolean;
	rating?: ForumRating;
}

export interface ForumThread {
	discussionId: number;
	forumId: number;
	courseId: number;
	posts: ForumPost[];
}

export interface ForumPostInput {
	subject: string;
	message: string;
	files?: File[];
}

export interface MoodleContact {
	id: number;
	fullName: string;
	imageUrl?: string;
	isOnline?: boolean;
	isBlocked?: boolean;
	isContact?: boolean;
}

export interface ConversationMessage {
	id: number;
	fromUserId: number;
	/** Plain text (Moodle strips markup from messages). */
	text: string;
	time: string;
}

export interface MoodleConversation {
	id: number;
	name: string;
	imageUrl?: string;
	/** 1 = private, 2 = group, 3 = self. */
	type: 1 | 2 | 3;
	memberCount: number;
	muted: boolean;
	favourite: boolean;
	unread: number;
	members: MoodleContact[];
	lastMessage?: ConversationMessage;
	canDeleteForAll: boolean;
}

export interface ConversationThread {
	id: number;
	members: MoodleContact[];
	messages: ConversationMessage[];
}

export interface PeopleSearchResult {
	contacts: MoodleContact[];
	others: MoodleContact[];
}

export interface NotificationPreferenceRow {
	/** Moodle's preference key prefix, e.g. message_provider_moodle_instantmessage. */
	key: string;
	label: string;
	component: string;
	channels: { name: string; label: string; enabled: boolean; locked: boolean }[];
}

export interface NotificationPreferences {
	rows: NotificationPreferenceRow[];
	/** Pre-4.0 sites store separate logged-in/logged-off lists. */
	legacy: boolean;
}

export interface ChatMessage {
	id: number;
	userId: number;
	system: boolean;
	text: string;
	time: string;
}

export interface ChatSession {
	start: number;
	end: number;
	complete: boolean;
	users: { userId: number; messageCount: number }[];
}

export interface ChatPoll {
	messages: ChatMessage[];
	lastTime: number;
}

export interface ChatRoom {
	/** Session token used for polling and sending. */
	sid: string;
}

export interface MeetingInfo {
	running: boolean;
	participantCount: number;
	canJoin: boolean;
	/** Why joining isn't possible right now. */
	message?: string;
	openingTime?: string;
	closingTime?: string;
}

export interface MeetingRecording {
	id: string;
	name: string;
	date?: string;
	playbacks: { type: string; url: string }[];
}

export interface MoodleCalendarEvent {
	id: number;
	name: string;
	description?: string;
	courseId?: number;
	courseName?: string;
	startDate: string;
	endDate?: string;
	type: "assignment" | "quiz" | "course" | "personal" | "other";
	url?: string;
}

export interface MoodleGradeItem {
	id: number;
	itemName: string;
	grade?: number;
	maxGrade?: number;
	percentage?: number;
	letterGrade?: string;
	feedback?: string;
	gradedDate?: string;
}

export interface MoodleCourseGrades {
	courseId: number;
	courseName: string;
	items: MoodleGradeItem[];
	courseTotal?: number;
	courseMaxTotal?: number;
}

export interface MoodleNotification {
	id: number;
	subject: string;
	body?: string;
	read: boolean;
	timeCreated: string;
	courseId?: number;
	url?: string;
	/** Moodle component that sent it, e.g. mod_forum. */
	component?: string;
	eventType?: string;
}

export type MoodleErrorCode =
	| "network_error"
	| "invalid_token"
	| "site_unavailable"
	| "unsupported_function"
	| "access_denied"
	| "file_too_large"
	| "malformed_response"
	| "unknown_error";

export class MoodleError extends Error {
	code: MoodleErrorCode;
	/** Moodle's own error code, kept for debugging; never shown to users. */
	moodleCode?: string;

	constructor(code: MoodleErrorCode, message: string, moodleCode?: string) {
		super(message);
		this.name = "MoodleError";
		this.code = code;
		this.moodleCode = moodleCode;
	}
}

export interface MoodleParticipant {
	id: number;
	fullName: string;
	imageUrl?: string;
	roles: string[];
	lastAccess?: string;
	groups: { id: number; name: string }[];
}

export interface CourseCompletion {
	completed: boolean;
	criteria: { title: string; complete: boolean }[];
	/** The course has a "manual self completion" criterion the student hasn't ticked yet. */
	canSelfComplete: boolean;
}

export interface CourseBlock {
	id: number;
	name: string;
	title: string;
	html: string;
}
