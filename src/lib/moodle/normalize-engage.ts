import type {
	Choice,
	ChoiceOption,
	ChoiceResult,
	Feedback,
	FeedbackAccess,
	FeedbackAnalysis,
	FeedbackAnalysisItem,
	FeedbackAnswers,
	FeedbackChoice,
	FeedbackItem,
	FeedbackItemType,
	FeedbackPage,
	FeedbackProcessResult,
	FeedbackResponse,
	FeedbackResponseValue,
	Survey,
	SurveyAnswers,
	SurveyQuestion,
} from "@/types/engage";
import { asArray, asRecord } from "./normalize";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const time = (seconds: unknown) => (Number(seconds) > 0 ? new Date(Number(seconds) * 1000).toISOString() : undefined);
const round1 = (n: number) => Math.round(n * 10) / 10;

// ---- choice ----

// mod_choice_get_choices_by_courses
export function normalizeChoices(raw: unknown): Choice[] {
	return asArray(asRecord(raw).choices).map((c) => {
		const r = asRecord(c);
		return {
			id: Number(r.id),
			cmid: Number(r.coursemodule ?? 0),
			courseId: Number(r.course ?? 0),
			name: String(r.name ?? ""),
			intro: str(r.intro),
			publishNames: Number(r.publish) === 1,
			showResults: Number(r.showresults ?? 0),
			allowUpdate: Boolean(r.allowupdate),
			allowMultiple: Boolean(r.allowmultiple),
			timeOpen: time(r.timeopen),
			timeClose: time(r.timeclose),
		};
	});
}

// mod_choice_get_choice_options
export function normalizeChoiceOptions(raw: unknown): ChoiceOption[] {
	return asArray(asRecord(raw).options).map((o) => {
		const r = asRecord(o);
		return {
			id: Number(r.id),
			text: String(r.text ?? ""),
			maxAnswers: Number(r.maxanswers ?? 0),
			count: Number(r.countanswers ?? 0),
			checked: Boolean(r.checked),
			disabled: Boolean(r.disabled),
		};
	});
}

// mod_choice_get_choice_results
export function normalizeChoiceResults(raw: unknown): ChoiceResult[] {
	return asArray(asRecord(raw).options).map((o) => {
		const r = asRecord(o);
		return {
			id: Number(r.id),
			text: String(r.text ?? ""),
			votes: Number(r.numberofuser ?? 0),
			percent: round1(Number(r.percentageamount ?? 0)),
			voters: asArray(r.userresponses)
				.map(asRecord)
				.filter((u) => Number(u.userid) > 0)
				.map((u) => ({ userId: Number(u.userid), fullName: String(u.fullname ?? ""), imageUrl: str(u.profileimageurl) })),
		};
	});
}

// ---- feedback ----

// mod_feedback_get_feedbacks_by_courses
export function normalizeFeedbacks(raw: unknown): Feedback[] {
	return asArray(asRecord(raw).feedbacks).map((f) => {
		const r = asRecord(f);
		return {
			id: Number(r.id),
			cmid: Number(r.coursemodule ?? 0),
			courseId: Number(r.course ?? 0),
			name: String(r.name ?? ""),
			intro: str(r.intro),
			anonymous: Number(r.anonymous) === 1,
			multipleSubmit: r.multiple_submit === undefined ? true : Boolean(r.multiple_submit),
			publishStats: Boolean(r.publish_stats),
			completionMessage: str(r.page_after_submit),
			afterSubmitUrl: str(r.site_after_submit),
			timeOpen: time(r.timeopen),
			timeClose: time(r.timeclose),
		};
	});
}

// mod_feedback_get_feedback_access_information
export function normalizeFeedbackAccess(raw: unknown): FeedbackAccess {
	const r = asRecord(raw);
	return {
		canComplete: Boolean(r.cancomplete),
		canSubmit: Boolean(r.cansubmit),
		canViewAnalysis: Boolean(r.canviewanalysis),
		canViewReports: Boolean(r.canviewreports),
		isOpen: r.isopen === undefined ? true : Boolean(r.isopen),
		isEmpty: Boolean(r.isempty),
		isAlreadySubmitted: Boolean(r.isalreadysubmitted),
	};
}

const TYPE_SEP = ">>>>>";
const ADJUST_SEP = "<<<<<";
const LIST_SEP = "|";
const RATING_SEP = "####";
const STYLES = { r: "radio", c: "check", d: "dropdown" } as const;

/** Splits a multichoice `presentation` ("r>>>>>a|b|c<<<<<1", rated: "d>>>>>1####a|2####b") into style and options. */
export function parseChoicePresentation(presentation: string): { style: "radio" | "check" | "dropdown"; choices: FeedbackChoice[] } {
	const at = presentation.indexOf(TYPE_SEP);
	const flag = at >= 0 ? presentation.slice(0, at).trim() : "r";
	const body = (at >= 0 ? presentation.slice(at + TYPE_SEP.length) : presentation).split(ADJUST_SEP)[0];
	const choices = body
		.split(LIST_SEP)
		.map((label, i) => {
			const rated = label.indexOf(RATING_SEP);
			return { value: i + 1, label: (rated >= 0 ? label.slice(rated + RATING_SEP.length) : label).trim() };
		})
		.filter((c) => c.label);
	return { style: STYLES[flag as keyof typeof STYLES] ?? "radio", choices };
}

const bound = (v: string | undefined) => {
	const n = Number(v);
	return v === undefined || v.trim() === "" || v.trim() === "-" || Number.isNaN(n) ? undefined : n;
};

const CHOICE_TYPES = new Set(["multichoice", "multichoicerated"]);
const KNOWN_TYPES = new Set<string>(["label", "textfield", "textarea", "multichoice", "numeric", "info", "captcha"]);

function normalizeItem(raw: unknown): FeedbackItem {
	const r = asRecord(raw);
	const rawType = String(r.typ ?? "");
	const presentation = String(r.presentation ?? "");
	const isChoice = CHOICE_TYPES.has(rawType);
	const type = (isChoice ? "multichoice" : KNOWN_TYPES.has(rawType) ? rawType : "unsupported") as FeedbackItemType;
	const item: FeedbackItem = {
		id: Number(r.id),
		type,
		rawType,
		name: String(r.name ?? ""),
		required: Boolean(r.required),
		dependItem: Number(r.dependitem ?? 0),
		dependValue: String(r.dependvalue ?? ""),
	};
	if (type === "label") item.html = presentation;
	if (type === "textfield") item.maxLength = Number(presentation.split(LIST_SEP)[1]) || undefined;
	if (type === "numeric") {
		const [min, max] = presentation.split(LIST_SEP);
		item.min = bound(min);
		item.max = bound(max);
	}
	if (type === "info") item.infoKind = Number(presentation) || 1;
	if (isChoice) {
		const parsed = parseChoicePresentation(presentation);
		item.style = parsed.style;
		item.choices = parsed.choices;
		item.hideNoSelect = String(r.options ?? "").split(/[;,\s]+/).some((o) => o === "h" || o === "hidenoselect");
	}
	return item;
}

// mod_feedback_get_page_items
export function normalizeFeedbackPage(raw: unknown): FeedbackPage {
	const r = asRecord(raw);
	return {
		items: asArray(r.items)
			.filter((i) => asRecord(i).typ !== "pagebreak")
			.map(normalizeItem),
		hasPrev: Boolean(r.hasprevpage),
		hasNext: Boolean(r.hasnextpage),
	};
}

const isInput = (item: FeedbackItem) => item.type !== "label" && item.type !== "captcha" && item.type !== "unsupported" && item.type !== "info";

const blank = (item: FeedbackItem): string | string[] => (item.style === "check" ? [] : "");

/** Starting answers for a page's inputs, keeping anything already answered. */
export function seedAnswers(items: FeedbackItem[], answers: FeedbackAnswers): FeedbackAnswers {
	const next = { ...answers };
	for (const item of items) if (isInput(item) && next[item.id] === undefined) next[item.id] = blank(item);
	return next;
}

/** Items depending on another item show only while it holds the required value; unknown (unvisited) answers don't hide. */
export function isItemVisible(item: FeedbackItem, answers: FeedbackAnswers): boolean {
	if (!item.dependItem) return true;
	const dep = answers[item.dependItem];
	if (dep === undefined) return true;
	return Array.isArray(dep) ? dep.includes(item.dependValue) : dep === item.dependValue;
}

const isEmptyAnswer = (answer: string | string[] | undefined) =>
	answer === undefined || (Array.isArray(answer) ? answer.length === 0 : answer.trim() === "" || answer === "0");

/** Visible required inputs the user hasn't answered. */
export function missingRequired(items: FeedbackItem[], answers: FeedbackAnswers): number[] {
	return items.filter((i) => isInput(i) && i.required && isItemVisible(i, answers) && isEmptyAnswer(answers[i.id])).map((i) => i.id);
}

/** Answers out-of-range for numeric items. */
export function invalidNumeric(items: FeedbackItem[], answers: FeedbackAnswers): number[] {
	return items
		.filter((i) => i.type === "numeric" && isItemVisible(i, answers))
		.filter((i) => {
			const a = answers[i.id];
			if (typeof a !== "string" || a.trim() === "") return false;
			const n = Number(a);
			return Number.isNaN(n) || (i.min !== undefined && n < i.min) || (i.max !== undefined && n > i.max);
		})
		.map((i) => i.id);
}

/** name/value pairs for mod_feedback_process_page. Checkbox groups post `type_id[index]` = option number for each ticked option. */
export function feedbackResponses(items: FeedbackItem[], answers: FeedbackAnswers, nowMs = Date.now()): FeedbackResponse[] {
	const out: FeedbackResponse[] = [];
	for (const item of items) {
		if (!isItemVisible(item, answers)) continue;
		const name = `${item.rawType}_${item.id}`;
		if (item.type === "info") {
			if (item.infoKind === 1) out.push({ name, value: String(Math.floor(nowMs / 1000)) });
			continue;
		}
		if (!isInput(item)) continue;
		const answer = answers[item.id] ?? blank(item);
		if (Array.isArray(answer)) {
			for (const value of answer) out.push({ name: `${name}[${Number(value) - 1}]`, value });
		} else if (item.type === "multichoice") {
			out.push({ name, value: answer || "0" });
		} else {
			out.push({ name, value: answer });
		}
	}
	return out;
}

// mod_feedback_process_page
export function normalizeFeedbackProcess(raw: unknown, currentPage: number): FeedbackProcessResult {
	const r = asRecord(raw);
	const jump = Number(r.jumpto);
	return {
		page: Number.isInteger(jump) && jump >= 0 ? jump : currentPage,
		completed: Boolean(r.completed),
		message: str(r.completionpagecontents),
		redirectUrl: str(r.siteaftersubmit),
	};
}

function parseData(entry: unknown): unknown {
	if (typeof entry !== "string") return entry;
	try {
		return JSON.parse(entry);
	} catch {
		return entry;
	}
}

function analyseItem(raw: unknown): FeedbackAnalysisItem {
	const r = asRecord(raw);
	const item = asRecord(r.item);
	const out: FeedbackAnalysisItem = { id: Number(item.id), name: String(item.name ?? ""), type: String(item.typ ?? ""), choices: [], texts: [], stats: [] };
	for (const entry of asArray(r.data).map(parseData)) {
		if (entry && typeof entry === "object" && !Array.isArray(entry)) {
			const e = entry as Record<string, unknown>;
			if (e.answertext !== undefined) {
				out.choices.push({ label: String(e.answertext), count: Number(e.answercount ?? 0), percent: round1(Number(e.quotient ?? 0) * 100) });
			} else {
				for (const [label, value] of Object.entries(e)) out.stats.push({ label, value: String(value) });
			}
		} else if (entry !== null && entry !== undefined && String(entry) !== "") {
			out.texts.push(String(entry));
		}
	}
	return out;
}

// mod_feedback_get_analysis
export function normalizeFeedbackAnalysis(raw: unknown): FeedbackAnalysis {
	const r = asRecord(raw);
	return {
		completedCount: Number(r.completedcount ?? 0),
		items: asArray(r.itemsdata).map(analyseItem).filter((i) => i.type !== "label" && i.type !== "pagebreak"),
	};
}

// mod_feedback_get_finished_responses
export function normalizeFinishedResponses(raw: unknown): FeedbackResponseValue[] {
	return asArray(asRecord(raw).responses).map((v) => {
		const r = asRecord(v);
		return { id: Number(r.id), name: String(r.name ?? ""), value: String(r.printval ?? r.rawval ?? "") };
	});
}

// ---- survey ----

// mod_survey_get_surveys_by_courses
export function normalizeSurveys(raw: unknown): Survey[] {
	return asArray(asRecord(raw).surveys).map((s) => {
		const r = asRecord(s);
		return {
			id: Number(r.id),
			cmid: Number(r.coursemodule ?? 0),
			courseId: Number(r.course ?? 0),
			name: String(r.name ?? ""),
			intro: str(r.intro),
			done: Boolean(r.surveydone),
		};
	});
}

const splitOptions = (v: unknown) =>
	String(v ?? "")
		.split(",")
		.map((o) => o.trim())
		.filter(Boolean);

const isScaleType = (t: number) => t >= 1 && t <= 3;

/**
 * mod_survey_get_questions. Parents with `multi` are group headings; their sub-questions inherit the
 * scale. Type 0 is free text, 1 the "actual" scale, 2 the "preferred" scale, 3 both.
 */
export function normalizeSurveyQuestions(raw: unknown): SurveyQuestion[] {
	const rows = asArray(asRecord(raw).questions).map(asRecord);
	const byId = new Map(rows.map((r) => [Number(r.id), r]));
	return rows.map((r) => {
		const parent = byId.get(Number(r.parent ?? 0));
		const ownType = Number(r.type ?? 0);
		const type = isScaleType(ownType) ? ownType : parent && isScaleType(Number(parent.type)) ? Number(parent.type) : ownType;
		const options = splitOptions(r.options).length ? splitOptions(r.options) : splitOptions(parent?.options);
		const kind = str(r.multi) || (type !== 0 && !options.length) ? "header" : type === 0 ? "text" : "scale";
		return {
			id: Number(r.id),
			text: String(r.text ?? r.shorttext ?? ""),
			kind,
			intro: str(r.intro),
			options,
			actual: type === 1 || type === 3,
			preferred: type === 2 || type === 3,
			isSub: Boolean(parent),
		};
	});
}

export const surveyKey = (id: number, preferred = false) => `${preferred ? "qP" : "q"}${id}`;

/** Answer keys a question still needs, for the submit check. */
function surveyKeys(q: SurveyQuestion): string[] {
	if (q.kind !== "scale") return [];
	return [q.actual && surveyKey(q.id), q.preferred && surveyKey(q.id, true)].filter((k): k is string => Boolean(k));
}

export function unansweredSurveyKeys(questions: SurveyQuestion[], answers: SurveyAnswers): string[] {
	return questions.flatMap(surveyKeys).filter((k) => !answers[k]);
}

/** key/value pairs for mod_survey_submit_answers (scale answers are option numbers, text is as typed). */
export function surveyAnswerList(questions: SurveyQuestion[], answers: SurveyAnswers): { key: string; value: string }[] {
	const keys = questions.flatMap((q) => (q.kind === "text" ? [surveyKey(q.id)] : surveyKeys(q)));
	return keys.filter((k) => answers[k]?.trim()).map((key) => ({ key, value: answers[key].trim() }));
}
