import type { GlossaryApi } from "./client-glossary";
import type { Glossary, GlossaryEntry, GlossaryQuery } from "@/types/glossary";

const wait = <T>(value: T, ms = 200): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));

const glossaries: Glossary[] = [
	{ id: 1, cmid: 41, courseId: 1, name: "Key terms", intro: "<p>Definitions you'll meet in this course.</p>", browseModes: ["letter", "category", "author", "date"], canAddEntry: true },
];
const categories = [{ id: 1, name: "Analysis" }, { id: 2, name: "Algebra" }];
const entryCategory = new Map<number, number>([[1, 1], [2, 1], [3, 2], [4, 2]]);

const entry = (id: number, concept: string, definition: string, author: string, daysAgo: number): GlossaryEntry => ({
	id, glossaryId: 1, concept, definition: `<p>${definition}</p>`, author, userId: id, approved: true, canEdit: false, canDelete: false,
	created: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
	modified: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});
const entries: GlossaryEntry[] = [
	entry(1, "Convergence", "A sequence converges when its terms approach a single value.", "Prof. Silva", 9),
	entry(2, "Derivative", "The instantaneous rate of change of a function.", "Prof. Silva", 7),
	entry(3, "Eigenvalue", "A scalar λ such that Av = λv for some non-zero vector v.", "Ana Costa", 4),
	entry(4, "Matrix", "A rectangular array of numbers.", "Rui Ferreira", 2),
	entry(5, "2-norm", "The Euclidean length of a vector.", "Ana Costa", 1),
];

const matches = (e: GlossaryEntry, q: GlossaryQuery) => {
	switch (q.mode) {
		case "letter":
			if (q.letter === "ALL") return true;
			return q.letter === "SPECIAL" ? !/^[a-z]/i.test(e.concept) : e.concept.toUpperCase().startsWith(q.letter);
		case "search":
			return `${e.concept} ${e.definition}`.toLowerCase().includes(q.text.toLowerCase());
		case "category":
			return q.categoryId === 0 || entryCategory.get(e.id) === q.categoryId;
		default:
			return true;
	}
};

export function createMockGlossaryApi(): GlossaryApi {
	return {
		getGlossaries: (courseId) => wait(glossaries.filter((g) => g.courseId === courseId)),
		getGlossaryCategories: () => wait(categories),
		getGlossaryEntries: (_id, query, limit) => {
			const found = entries.filter((e) => matches(e, query));
			if (query.mode === "date") found.sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""));
			if (query.mode === "author") found.sort((a, b) => a.author.localeCompare(b.author));
			return wait({ entries: found.slice(0, limit), total: found.length });
		},
		logGlossaryView: () => wait(undefined, 0),
	};
}
