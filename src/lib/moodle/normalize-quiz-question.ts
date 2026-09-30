import type {
	QuizChoiceOption,
	QuizCorrectness,
	QuizFeedbackBlock,
	QuizFlagTarget,
	QuizMatchRow,
	QuizQuestion,
	QuizQuestionBody,
	QuizQuestionState,
} from "@/types/quiz";
import { asRecord } from "./normalize";

/**
 * Moodle hands quiz questions over as rendered HTML forms. These parsers lift the controls of the
 * question types we can render natively into typed data; anything else stays `unsupported` and is
 * shown read-only. Browser only (DOMParser).
 */

const CHOICE_TYPES = new Set(["multichoice", "truefalse", "calculatedmulti"]);
const TEXT_TYPES = new Set(["shortanswer", "numerical", "calculated", "calculatedsimple"]);
export const SUPPORTED_QTYPES: ReadonlySet<string> = new Set([...CHOICE_TYPES, ...TEXT_TYPES, "match", "essay", "description"]);

// `q<usageid>:<slot>_<name>`; behaviour variables (`_-submit`, `_-mark`) and the flag field aren't answers
const FIELD_NAME = /^q\d+:\d+_/;
const IGNORED_FIELD = /^q\d+:\d+_(-|:flagged$)/;
const SKIPPED_INPUT_TYPES = new Set(["submit", "button", "image", "reset", "file"]);

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";

function correctnessOf(el: { classList: DOMTokenList } | null | undefined): QuizCorrectness | undefined {
	if (!el) return undefined;
	const c = el.classList;
	if (c.contains("partiallycorrect")) return "partial";
	if (c.contains("incorrect")) return "incorrect";
	if (c.contains("correct")) return "correct";
	return undefined;
}

/** Moodle question state -> the few states the UI distinguishes. */
export function mapQuestionState(state: unknown): QuizQuestionState {
	switch (String(state ?? "")) {
		case "complete":
			return "complete";
		case "gradedright":
		case "mangrright":
			return "correct";
		case "gradedpartial":
		case "mangrpartial":
			return "partial";
		case "gradedwrong":
		case "mangrwrong":
			return "incorrect";
		case "gaveup":
		case "finished":
			return "gaveup";
		case "needsgrading":
			return "needsgrading";
		case "todo":
		case "invalid":
		case "":
			return "todo";
		default:
			return "other";
	}
}

/** Every answer field the form would post, with the value it was rendered with. */
function collectFields(root: Element): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const node of root.querySelectorAll("input[name], select[name], textarea[name]")) {
		const el = node as FormControl;
		const name = el.getAttribute("name") ?? "";
		if (!FIELD_NAME.test(name) || IGNORED_FIELD.test(name)) continue;
		const tag = el.tagName.toLowerCase();
		const type = tag === "input" ? (el.getAttribute("type") ?? "text").toLowerCase() : tag;
		if (SKIPPED_INPUT_TYPES.has(type)) continue;
		const input = el as HTMLInputElement;
		// a hidden "0" precedes each checkbox and a "-1" each single choice; a ticked control overrides it
		if ((type === "radio" || type === "checkbox") && !input.checked) continue;
		fields[name] = el.value;
	}
	return fields;
}

function parseOptionRow(input: HTMLInputElement): QuizChoiceOption & { field: string } {
	const row = input.closest(".r0, .r1") ?? input.parentElement ?? input;
	const feedbackHtml = row.querySelector(".specificfeedback")?.innerHTML.trim();
	const clone = row.cloneNode(true) as Element;
	for (const junk of clone.querySelectorAll("input, .answernumber, .specificfeedback, .questioncorrectnessicon, img.icon, i.icon")) junk.remove();
	// unwrap Moodle's label/flex wrappers so only the answer content remains
	for (const wrapper of clone.querySelectorAll("label, .d-flex, .flex-fill")) wrapper.replaceWith(...wrapper.childNodes);
	return {
		field: input.name,
		value: input.value,
		html: clone.innerHTML.trim(),
		feedbackHtml: feedbackHtml || undefined,
		correctness: correctnessOf(row) ?? correctnessOf(input),
	};
}

function parseChoice(root: Element): QuizQuestionBody | null {
	const inputs = [...root.querySelectorAll<HTMLInputElement>('.answer input[type="radio"], .answer input[type="checkbox"]')].filter((i) => i.value !== "-1");
	if (inputs.length === 0) return null;
	const multiple = inputs[0].type === "checkbox";
	return {
		kind: "choice",
		multiple,
		prompt: text(root.querySelector(".prompt")) || undefined,
		field: inputs[0].name,
		options: inputs.map(parseOptionRow),
	};
}

function parseText(root: Element, numeric: boolean): QuizQuestionBody | null {
	const input = root.querySelector<HTMLInputElement>('input[type="text"][name$="_answer"], input[name$="_answer"]:not([type])');
	if (!input) return null;
	const unitEl = root.querySelector('input[type="text"][name$="_unit"], select[name$="_unit"]') as HTMLInputElement | HTMLSelectElement | null;
	const unit = unitEl && {
		field: unitEl.name,
		options: unitEl.tagName.toLowerCase() === "select" ? [...(unitEl as HTMLSelectElement).options].map((o) => ({ value: o.value, label: text(o) })) : undefined,
	};
	return { kind: "text", field: input.name, numeric, correctness: correctnessOf(input) ?? correctnessOf(input.parentElement), ...(unit && { unit }) };
}

function parseMatch(root: Element): QuizQuestionBody | null {
	const rows: QuizMatchRow[] = [];
	for (const tr of root.querySelectorAll(".answer tr")) {
		const select = tr.querySelector("select");
		if (!select?.name) continue;
		rows.push({
			field: select.name,
			stemHtml: tr.querySelector("td.text")?.innerHTML.trim() ?? "",
			options: [...select.options].map((o) => ({ value: o.value, label: text(o) })),
			correctness: correctnessOf(tr.querySelector("td.control")) ?? correctnessOf(select),
		});
	}
	return rows.length ? { kind: "match", rows } : null;
}

function parseEssay(root: Element): QuizQuestionBody | null {
	const area = root.querySelector<HTMLTextAreaElement>('textarea[name$="_answer"]');
	const display = root.querySelector(".qtype_essay_response");
	if (!area && !display) return null;
	const formatField = root.querySelector<HTMLInputElement>('input[name$="_answerformat"]');
	return {
		kind: "essay",
		field: area?.name,
		formatField: formatField?.name,
		format: Number(formatField?.value ?? 1),
		responseHtml: display?.innerHTML.trim(),
		hasAttachments: Boolean(root.querySelector(".attachments, .filemanager, input[name$='_attachments']")),
	};
}

function parseBody(qtype: string, root: Element): QuizQuestionBody {
	let body: QuizQuestionBody | null = null;
	if (qtype === "description") body = { kind: "description" };
	else if (CHOICE_TYPES.has(qtype)) body = parseChoice(root);
	else if (TEXT_TYPES.has(qtype)) body = parseText(root, qtype !== "shortanswer");
	else if (qtype === "match") body = parseMatch(root);
	else if (qtype === "essay") body = parseEssay(root);
	return body ?? { kind: "unsupported" };
}

const FEEDBACK_SELECTORS: [QuizFeedbackBlock["kind"], string][] = [
	["specific", ".outcome .specificfeedback"],
	["general", ".outcome .generalfeedback"],
	["rightanswer", ".outcome .rightanswer"],
];

function parseFeedback(root: Element): QuizFeedbackBlock[] {
	const blocks: QuizFeedbackBlock[] = [];
	for (const [kind, selector] of FEEDBACK_SELECTORS) {
		for (const el of root.querySelectorAll(selector)) if (text(el)) blocks.push({ kind, html: el.innerHTML.trim() });
	}
	// nested `.comment` wrappers: only the innermost holds the teacher's text
	for (const el of root.querySelectorAll(".content .comment")) {
		if (!el.querySelector(".comment") && text(el)) blocks.push({ kind: "teacher", html: el.innerHTML.trim() });
	}
	return blocks;
}

function parseFlag(root: Element, fallbackQubaId: number): QuizFlagTarget | undefined {
	const raw = root.querySelector<HTMLInputElement>("input.questionflagpostdata")?.value;
	if (!raw) return undefined;
	const p = new URLSearchParams(raw);
	const qaId = Number(p.get("qaid"));
	const questionId = Number(p.get("questionid"));
	const slot = Number(p.get("slot"));
	const checksum = p.get("checksum");
	if (!qaId || !questionId || !slot || !checksum) return undefined;
	return { qubaId: Number(p.get("qubaid")) || fallbackQubaId, qaId, questionId, slot, checksum };
}

function fieldsAreLocked(root: Element): boolean {
	const controls = ([...root.querySelectorAll("input, select, textarea")] as FormControl[]).filter((el) => {
		const type = el.getAttribute("type")?.toLowerCase();
		return type !== "hidden" && type !== "submit" && type !== "button" && !el.classList.contains("questionflagcheckbox") && FIELD_NAME.test(el.getAttribute("name") ?? "");
	});
	return controls.length > 0 && controls.every((el) => el.hasAttribute("disabled") || el.hasAttribute("readonly"));
}

const optional = (v: unknown) => (v === undefined || v === null || v === "" || v === false ? undefined : String(v));

/**
 * One entry of `questions` from mod_quiz_get_attempt_data / _get_attempt_review.
 * `qubaId` is the attempt's question usage id (a fallback for the flag target).
 */
export function normalizeQuizQuestion(raw: unknown, opts: { review?: boolean; qubaId?: number } = {}): QuizQuestion {
	const r = asRecord(raw);
	const html = String(r.html ?? "");
	const root = new DOMParser().parseFromString(html, "text/html").body;
	const que = root.querySelector(".que") ?? root;
	const qtype = String(r.type ?? [...(que.classList ?? [])].find((c) => c !== "que" && c !== "deferredfeedback") ?? "unknown");
	const body = parseBody(qtype, que);
	const number = optional(r.number) ?? optional(text(que.querySelector(".info .no .qno")));
	const stem = que.querySelector(".qtext");
	return {
		slot: Number(r.slot),
		page: Number(r.page ?? 0),
		qtype,
		number: qtype === "description" ? undefined : number,
		stateLabel: String(r.status ?? text(que.querySelector(".info .state"))),
		state: mapQuestionState(r.state),
		flagged: Boolean(r.flagged),
		maxMark: optional(r.maxmark),
		mark: optional(r.mark),
		// unsupported types keep their whole formulation (gaps, drop zones) for the read-only view
		textHtml: (body.kind === "unsupported" ? que.querySelector(".formulation") ?? stem : stem)?.innerHTML.trim() ?? "",
		html,
		body,
		fields: body.kind === "unsupported" || body.kind === "description" ? {} : collectFields(que),
		feedback: parseFeedback(que),
		flag: parseFlag(que, opts.qubaId ?? 0),
		readOnly: Boolean(opts.review) || fieldsAreLocked(que),
	};
}
