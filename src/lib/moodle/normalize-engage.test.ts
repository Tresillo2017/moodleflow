import { describe, expect, it } from "vitest";
import {
	feedbackResponses,
	invalidNumeric,
	isItemVisible,
	missingRequired,
	normalizeChoiceOptions,
	normalizeChoiceResults,
	normalizeChoices,
	normalizeFeedbackAnalysis,
	normalizeFeedbackPage,
	normalizeFeedbackProcess,
	normalizeFinishedResponses,
	normalizeSurveyQuestions,
	normalizeSurveys,
	parseChoicePresentation,
	seedAnswers,
	surveyAnswerList,
	unansweredSurveyKeys,
} from "./normalize-engage";

describe("choice", () => {
	it("maps settings and drops zero times", () => {
		const [c] = normalizeChoices({ choices: [{ id: 3, coursemodule: 9, course: 2, name: "Pick", publish: 1, showresults: 3, allowupdate: 1, allowmultiple: 0, timeopen: 0, timeclose: 100 }] });
		expect(c).toMatchObject({ id: 3, cmid: 9, publishNames: true, showResults: 3, allowUpdate: true, allowMultiple: false, timeOpen: undefined });
		expect(c.timeClose).toBe(new Date(100_000).toISOString());
	});

	it("maps options and results with voters", () => {
		expect(normalizeChoiceOptions({ options: [{ id: 1, text: "A", maxanswers: 2, countanswers: 1, checked: true, disabled: false }] })[0]).toMatchObject({ id: 1, maxAnswers: 2, count: 1, checked: true });
		const [r] = normalizeChoiceResults({ options: [{ id: 1, text: "A", numberofuser: 2, percentageamount: 66.666, userresponses: [{ userid: 4, fullname: "Ana" }, { userid: 0, fullname: "" }] }] });
		expect(r).toMatchObject({ votes: 2, percent: 66.7, voters: [{ userId: 4, fullName: "Ana" }] });
	});

	it("tolerates an empty response", () => {
		expect(normalizeChoiceOptions({})).toEqual([]);
	});
});

describe("feedback items", () => {
	it("parses multichoice presentations", () => {
		expect(parseChoicePresentation("c>>>>>Red|Green<<<<<1")).toEqual({ style: "check", choices: [{ value: 1, label: "Red" }, { value: 2, label: "Green" }] });
		expect(parseChoicePresentation("d>>>>>1####Bad|5####Good").choices).toEqual([{ value: 1, label: "Bad" }, { value: 2, label: "Good" }]);
	});

	it("normalizes every item type and drops page breaks", () => {
		const page = normalizeFeedbackPage({
			hasnextpage: true,
			items: [
				{ id: 1, typ: "label", name: "", presentation: "<p>Hi</p>" },
				{ id: 2, typ: "textfield", name: "Name", presentation: "20|30", required: 1 },
				{ id: 3, typ: "numeric", name: "Age", presentation: "0|120" },
				{ id: 4, typ: "multichoicerated", name: "Rate", presentation: "r>>>>>1####Bad|2####Good", options: "h" },
				{ id: 5, typ: "pagebreak" },
				{ id: 6, typ: "captcha", name: "Robot?" },
				{ id: 7, typ: "somethingnew", name: "?" },
			],
		});
		expect(page.hasNext).toBe(true);
		expect(page.items.map((i) => i.type)).toEqual(["label", "textfield", "numeric", "multichoice", "captcha", "unsupported"]);
		expect(page.items[0].html).toBe("<p>Hi</p>");
		expect(page.items[1]).toMatchObject({ maxLength: 30, required: true });
		expect(page.items[2]).toMatchObject({ min: 0, max: 120 });
		expect(page.items[3]).toMatchObject({ style: "radio", hideNoSelect: true });
	});

	it("treats a dash as an open numeric bound", () => {
		expect(normalizeFeedbackPage({ items: [{ id: 1, typ: "numeric", presentation: "-|10" }] }).items[0]).toMatchObject({ min: undefined, max: 10 });
	});
});

describe("feedback answers", () => {
	const page = normalizeFeedbackPage({
		items: [
			{ id: 1, typ: "textfield", name: "T", presentation: "20|30", required: 1 },
			{ id: 2, typ: "multichoice", name: "R", presentation: "r>>>>>a|b" },
			{ id: 3, typ: "multichoice", name: "C", presentation: "c>>>>>x|y|z" },
			{ id: 4, typ: "textarea", name: "Why", presentation: "40|4", dependitem: 2, dependvalue: "2" },
			{ id: 5, typ: "info", name: "Date", presentation: "1" },
			{ id: 6, typ: "numeric", name: "N", presentation: "1|5" },
		],
	}).items;

	it("names responses the way Moodle's form does", () => {
		const answers = { ...seedAnswers(page, {}), 1: "hello", 2: "2", 3: ["1", "3"], 4: "because", 6: "3" };
		expect(feedbackResponses(page, answers, 5000)).toEqual([
			{ name: "textfield_1", value: "hello" },
			{ name: "multichoice_2", value: "2" },
			{ name: "multichoice_3[0]", value: "1" },
			{ name: "multichoice_3[2]", value: "3" },
			{ name: "textarea_4", value: "because" },
			{ name: "info_5", value: "5" },
			{ name: "numeric_6", value: "3" },
		]);
	});

	it("sends 0 for an unset single choice and skips hidden dependent items", () => {
		const answers = seedAnswers(page, { 1: "x" });
		const out = feedbackResponses(page, answers);
		expect(out).toContainEqual({ name: "multichoice_2", value: "0" });
		expect(out.some((r) => r.name === "textarea_4")).toBe(false);
	});

	it("shows dependents only for the matching value, and unknown answers don't hide", () => {
		expect(isItemVisible(page[3], { 2: "1" })).toBe(false);
		expect(isItemVisible(page[3], { 2: "2" })).toBe(true);
		expect(isItemVisible(page[3], {})).toBe(true);
	});

	it("finds missing required inputs and out-of-range numbers", () => {
		expect(missingRequired(page, seedAnswers(page, {}))).toEqual([1]);
		expect(missingRequired(page, seedAnswers(page, { 1: "ok" }))).toEqual([]);
		expect(invalidNumeric(page, { 6: "9" })).toEqual([6]);
		expect(invalidNumeric(page, { 6: "2" })).toEqual([]);
	});
});

describe("feedback results", () => {
	it("keeps the current page unless Moodle jumps", () => {
		expect(normalizeFeedbackProcess({ jumpto: 2 }, 1).page).toBe(2);
		expect(normalizeFeedbackProcess({ jumpto: -1 }, 1).page).toBe(1);
		expect(normalizeFeedbackProcess({ completed: true, completionpagecontents: "<p>Thanks</p>", siteaftersubmit: "https://x" }, 0)).toMatchObject({ completed: true, message: "<p>Thanks</p>", redirectUrl: "https://x" });
	});

	it("reads analysis data in JSON and plain shapes", () => {
		const { items, completedCount } = normalizeFeedbackAnalysis({
			completedcount: 4,
			itemsdata: [
				{ item: { id: 1, typ: "multichoice", name: "Pick" }, data: ['{"answertext":"A","answercount":3,"quotient":0.75}', '{"answertext":"B","answercount":1,"quotient":0.25}'] },
				{ item: { id: 2, typ: "textarea", name: "Why" }, data: ["fine", "great", ""] },
				{ item: { id: 3, typ: "numeric", name: "Age" }, data: ['{"average":"20.5"}'] },
				{ item: { id: 4, typ: "label" }, data: [] },
			],
		});
		expect(completedCount).toBe(4);
		expect(items).toHaveLength(3);
		expect(items[0].choices).toEqual([{ label: "A", count: 3, percent: 75 }, { label: "B", count: 1, percent: 25 }]);
		expect(items[1].texts).toEqual(["fine", "great"]);
		expect(items[2].stats).toEqual([{ label: "average", value: "20.5" }]);
	});

	it("maps finished responses", () => {
		expect(normalizeFinishedResponses({ responses: [{ id: 1, name: "Q", printval: "A" }, { id: 2, name: "R", rawval: "3" }] })).toEqual([{ id: 1, name: "Q", value: "A" }, { id: 2, name: "R", value: "3" }]);
	});
});

describe("survey", () => {
	it("maps done state", () => {
		expect(normalizeSurveys({ surveys: [{ id: 1, name: "S", surveydone: 1 }] })[0].done).toBe(true);
	});

	const questions = normalizeSurveyQuestions({
		questions: [
			{ id: 1, text: "Group", multi: "2,3", type: 3, options: "Never,Sometimes,Always", intro: "<p>i</p>" },
			{ id: 2, text: "Sub a", parent: 1, type: 3, options: "" },
			{ id: 3, text: "Sub b", parent: 1, type: 1, options: "" },
			{ id: 4, text: "Comments", type: 0 },
		],
	});

	it("gives sub-questions the parent's scale and marks headers and text", () => {
		expect(questions.map((q) => q.kind)).toEqual(["header", "scale", "scale", "text"]);
		expect(questions[1]).toMatchObject({ options: ["Never", "Sometimes", "Always"], actual: true, preferred: true, isSub: true });
		expect(questions[2]).toMatchObject({ actual: true, preferred: false });
	});

	it("tracks unanswered scales and builds the submission", () => {
		expect(unansweredSurveyKeys(questions, {})).toEqual(["q2", "qP2", "q3"]);
		const answers = { q2: "1", qP2: "3", q3: "2", q4: " thanks " };
		expect(unansweredSurveyKeys(questions, answers)).toEqual([]);
		expect(surveyAnswerList(questions, answers)).toEqual([
			{ key: "q2", value: "1" },
			{ key: "qP2", value: "3" },
			{ key: "q3", value: "2" },
			{ key: "q4", value: "thanks" },
		]);
	});
});
