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
	| "unknown";

export interface MoodleFile {
	name: string;
	url: string;
	size: number;
	mimeType?: string;
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
	visible: boolean;
}

export interface MoodleSection {
	id: number;
	name: string;
	summary?: string;
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
	cutoffDate?: string;
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
	feedbackFiles?: MoodleFile[];
}

export interface MoodleComment {
	id: number;
	author: string;
	/** Moodle HTML */
	content: string;
	time: string;
}

export interface MoodleForumDiscussion {
	id: number;
	subject: string;
	author: string;
	timeModified: string;
	replies: number;
	pinned: boolean;
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
