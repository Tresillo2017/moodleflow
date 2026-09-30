import { LESSON_EOL } from "@/types/lesson";
import type {
	LessonAccess,
	LessonAnswer,
	LessonFinish,
	LessonGrade,
	LessonInfo,
	LessonInput,
	LessonMatchPair,
	LessonOutlineEntry,
	LessonPage,
	LessonPageKind,
	LessonPageResult,
} from "@/types/lesson";
import { asArray, asRecord } from "./normalize";
import { stripHtml } from "./normalize-messaging";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const iso = (seconds: unknown) => (Number(seconds) > 0 ? new Date(Number(seconds) * 1000).toISOString() : undefined);
const messages = (raw: unknown) => asArray(raw).map((m) => String(typeof m === "object" && m ? asRecord(m).message ?? "" : m)).filter(Boolean);

// mod_lesson_get_lessons_by_courses
export function normalizeLessons(raw: unknown): LessonInfo[] {
	return asArray(asRecord(raw).lessons).map((l) => {
		const r = asRecord(l);
		return {
			id: Number(r.id),
			cmid: Number(r.coursemodule ?? 0),
			courseId: Number(r.course ?? 0),
			name: String(r.name ?? "Lesson"),
			intro: str(r.intro),
			available: iso(r.available),
			deadline: iso(r.deadline),
			timeLimit: Number(r.timelimit ?? 0),
			maxAttempts: Number(r.maxattempts ?? 0),
			retake: Boolean(Number(r.retake ?? 0)),
			review: Boolean(Number(r.review ?? 0)),
			practice: Boolean(Number(r.practice ?? 0)),
			progressBar: Boolean(Number(r.progressbar ?? 0)),
			ongoingScore: Boolean(Number(r.ongoing ?? 0)),
			passwordRequired: Boolean(Number(r.usepassword ?? 0)),
			grade: Number(r.grade ?? 0),
		};
	});
}

// mod_lesson_get_lesson_access_information
export function normalizeLessonAccess(raw: unknown): LessonAccess {
	const r = asRecord(raw);
	const pos = (v: unknown) => (Number(v) > 0 ? Number(v) : undefined);
	return {
		canManage: Boolean(r.canmanage),
		blocked: messages(r.preventaccessreasons),
		attempts: Number(r.attemptscount ?? r.numberofattempts ?? 0),
		firstPageId: pos(r.firstpageid),
		lastPageSeen: pos(r.lastpageseen),
	};
}

const KINDS: Record<number, LessonPageKind> = { 1: "shortanswer", 2: "truefalse", 3: "multichoice", 5: "matching", 8: "numerical", 10: "essay", 20: "content" };
export const lessonPageKind = (typeId: number): LessonPageKind => KINDS[typeId] ?? "unknown";

// mod_lesson_get_pages
export function normalizeLessonOutline(raw: unknown): LessonOutlineEntry[] {
	return asArray(asRecord(raw).pages).map((e) => {
		const p = asRecord(asRecord(e).page);
		return { id: Number(p.id), title: String(p.title ?? ""), kind: lessonPageKind(Number(p.typeid ?? p.qtype)), prevId: Number(p.prevpageid ?? 0), nextId: Number(p.nextpageid ?? 0) };
	});
}

/** Page ids in lesson order (Moodle stores pages as a linked list). */
export function orderOutline(entries: LessonOutlineEntry[]): LessonOutlineEntry[] {
	const byId = new Map(entries.map((e) => [e.id, e]));
	const ordered: LessonOutlineEntry[] = [];
	const seen = new Set<number>();
	for (let cur = entries.find((e) => e.prevId === 0); cur && !seen.has(cur.id); cur = byId.get(cur.nextId)) {
		seen.add(cur.id);
		ordered.push(cur);
	}
	return ordered.length ? ordered : entries;
}

const decodeAttr = (v: string) => v.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The `<select name="response[id]">` lists Moodle renders on a matching page. */
function parseMatchSelects(html: string): Map<number, { value: string; label: string }[]> {
	const selects = new Map<number, { value: string; label: string }[]>();
	for (const s of html.matchAll(/<select[^>]*\bname="response\[(\d+)\]"[^>]*>([\s\S]*?)<\/select>/gi)) {
		const options = [...s[2].matchAll(/<option[^>]*\bvalue="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi)]
			.map((o) => ({ value: decodeAttr(o[1]), label: stripHtml(o[2]) }))
			.filter((o) => o.value !== "");
		selects.set(Number(s[1]), options);
	}
	return selects;
}

function matchPairs(answers: LessonAnswer[], raw: unknown[], rendered: string): LessonMatchPair[] {
	const selects = parseMatchSelects(rendered);
	const responses = raw.map(asRecord).filter((a) => selects.has(Number(a.id)) || stripHtml(String(a.response ?? "")) !== "");
	// fallback when the page isn't parseable: every response text is a choice for every prompt
	const shared = [...new Set(responses.map((a) => String(a.response ?? "").trim()).filter(Boolean))].map((v) => ({ value: v, label: stripHtml(v) }));
	return answers
		.filter((a) => responses.some((r) => Number(r.id) === a.id) && stripHtml(a.text) !== "")
		.map((a) => ({ id: a.id, prompt: a.text, options: selects.get(a.id) ?? shared }));
}

/** `_qf__…` marker Moodle's form handler looks for, when the rendered page doesn't provide it. */
function defaultFormMarker(kind: LessonPageKind, multiple: boolean): string | undefined {
	if (kind === "multichoice") return `lesson_display_answer_form_multichoice_${multiple ? "multianswer" : "singleanswer"}`;
	if (["truefalse", "shortanswer", "numerical", "matching", "essay"].includes(kind)) return `lesson_display_answer_form_${kind}`;
	return undefined;
}

function hiddenMarkers(html: string): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const tag of html.matchAll(/<input[^>]*>/gi)) {
		const name = /\bname="(_qf__[^"]*)"/i.exec(tag[0])?.[1];
		if (name) fields[name] = decodeAttr(/\bvalue="([^"]*)"/i.exec(tag[0])?.[1] ?? "1");
	}
	return fields;
}

// mod_lesson_get_page_data
export function normalizeLessonPage(raw: unknown): LessonPage {
	const r = asRecord(raw);
	const p = asRecord(r.page);
	const typeId = Number(p.typeid ?? p.qtype ?? 0);
	const kind = lessonPageKind(typeId);
	const rendered = String(r.pagecontent ?? "");
	const rawAnswers = asArray(r.answers);
	const all: LessonAnswer[] = rawAnswers.map((a) => {
		const x = asRecord(a);
		return { id: Number(x.id), text: String(x.answer ?? ""), jumpTo: Number(x.jumpto ?? 0) };
	});
	const multiple = kind === "multichoice" && Number(p.qoption ?? 0) === 1;
	const pairs = kind === "matching" ? matchPairs(all, rawAnswers, rendered) : [];
	const marker = defaultFormMarker(kind, multiple);
	const progress = r.progress == null ? undefined : Number(r.progress);
	return {
		id: Number(p.id ?? r.newpageid),
		title: String(p.title ?? ""),
		kind,
		typeId,
		contents: String(p.contents ?? ""),
		rendered,
		prevId: Number(p.prevpageid ?? 0),
		nextId: Number(p.nextpageid ?? 0),
		answers: kind === "matching" ? [] : all.filter((a) => a.text.trim() !== ""),
		multiple,
		pairs,
		formFields: { ...(marker ? { [`_qf__${marker}`]: "1" } : {}), ...hiddenMarkers(rendered) },
		ongoingScore: str(r.ongoingscore),
		progress: Number.isFinite(progress) ? progress : undefined,
		messages: messages(r.messages),
	};
}

/** `data` name/value pairs for `mod_lesson_process_page`. */
export function lessonSubmission(page: LessonPage, input: LessonInput): { name: string; value: string }[] {
	const pairs: { name: string; value: string }[] = [];
	const add = (name: string, value: string | number) => pairs.push({ name, value: String(value) });
	if (page.kind === "content") {
		add("jumpto", input.jumpTo ?? 0);
		return pairs;
	}
	for (const [name, value] of Object.entries(page.formFields)) add(name, value);
	switch (page.kind) {
		case "multichoice":
			if (page.multiple) for (const id of input.choices ?? []) add(`answer[${id}]`, 1);
			else if (input.choice != null) add("answerid", input.choice);
			break;
		case "truefalse":
			if (input.choice != null) add("answerid", input.choice);
			break;
		case "shortanswer":
		case "numerical":
			add("answer", input.text ?? "");
			break;
		case "essay":
			add("answer_editor[text]", input.text ?? "");
			add("answer_editor[format]", 2);
			break;
		case "matching":
			for (const [id, value] of Object.entries(input.matches ?? {})) add(`response[${id}]`, value);
			break;
	}
	return pairs;
}

/** True when the learner has given enough of an answer to submit. */
export function isLessonInputComplete(page: LessonPage, input: LessonInput): boolean {
	switch (page.kind) {
		case "content":
			return input.jumpTo != null;
		case "multichoice":
			return page.multiple ? (input.choices?.length ?? 0) > 0 : input.choice != null;
		case "truefalse":
			return input.choice != null;
		case "shortanswer":
		case "numerical":
		case "essay":
			return (input.text ?? "").trim() !== "";
		case "matching":
			return page.pairs.every((p) => Boolean(input.matches?.[p.id]));
		default:
			return false;
	}
}

/** Where to go after `process_page`: a page id, or `LESSON_EOL`. 0 means stay (retry); other negatives are unresolved jumps, treated as "next". */
export function nextLessonPageId(newPageId: number, page: Pick<LessonPage, "id" | "nextId">): number {
	if (newPageId > 0) return newPageId;
	if (newPageId === 0) return page.id;
	if (newPageId === LESSON_EOL) return LESSON_EOL;
	return page.nextId || LESSON_EOL;
}

// mod_lesson_process_page
export function normalizeLessonResult(raw: unknown): LessonPageResult {
	const r = asRecord(raw);
	const progress = r.progress == null ? undefined : Number(r.progress);
	return {
		newPageId: Number(r.newpageid ?? 0),
		feedback: stripHtml(String(r.feedback ?? "")) ? String(r.feedback) : undefined,
		response: stripHtml(String(r.response ?? "")) ? String(r.response) : undefined,
		correct: Boolean(r.correctanswer),
		noAnswer: Boolean(r.noanswer),
		essay: Boolean(r.isessayquestion),
		attemptsRemaining: Number(r.attemptsremaining ?? 0),
		maxAttemptsReached: Boolean(r.maxattemptsreached),
		ongoingScore: str(r.ongoingscore),
		progress: Number.isFinite(progress) ? progress : undefined,
		messages: messages(r.messages),
	};
}

const RESULT_LABELS: Record<string, string> = {
	numberofpagesviewed: "Questions answered",
	numberofcorrectanswers: "Correct answers",
	earned: "Points earned",
	total: "Points possible",
	grade: "Grade",
	yourcurrentgradeisoutof: "Your grade",
};
const HIDDEN_RESULTS = new Set(["welldone", "progresscompleted", "eolstudentoutoftimenoanswers", "youshouldview", "gradelesson", "gradeessays", "displayscorewithessays", "displayscorewithoutessays"]);

// mod_lesson_finish_attempt
export function normalizeLessonFinish(raw: unknown): LessonFinish {
	const r = asRecord(raw);
	const results = asArray(r.data)
		.map(asRecord)
		.map((d) => ({ name: String(d.name ?? ""), value: String(d.value ?? "").trim() }))
		.filter((d) => d.value !== "" && !HIDDEN_RESULTS.has(d.name) && d.value.length <= 40 && !/[<>]/.test(d.value))
		.map((d) => ({ label: RESULT_LABELS[d.name] ?? d.name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase()), value: d.value }));
	return { messages: messages(r.messages), results };
}

// mod_lesson_get_user_grade
export function normalizeLessonGrade(raw: unknown): LessonGrade {
	const r = asRecord(raw);
	const grade = r.grade == null || r.grade === "" ? null : Number(r.grade);
	return { grade: grade != null && Number.isFinite(grade) ? grade : null, formatted: str(r.formattedgrade) };
}
