import type { BlogApi } from "./client-blog";
import type { BlogEntry, BlogInput } from "@/types/blog";

const wait = <T>(value: T, ms = 200): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const entries: BlogEntry[] = [
	{ id: 1, userId: 1, author: "Tomas", subject: "What I learned about eigenvalues", html: "<p>The geometric picture finally clicked: eigenvectors are the directions a matrix only stretches.</p>", tags: ["maths", "notes"], publishState: "site", created: ago(2), attachments: [], canEdit: true },
	{ id: 2, userId: 1, author: "Tomas", subject: "Revision plan (draft)", html: "<p>Series on Monday, integrals on Wednesday.</p>", tags: ["planning"], publishState: "draft", created: ago(1), attachments: [], canEdit: true },
	{ id: 3, userId: 2, author: "Ana Costa", subject: "Study group notes", html: "<p>We meet on Thursdays in the library.</p>", tags: ["notes"], publishState: "site", created: ago(5), attachments: [], canEdit: false },
];
let nextId = 4;

const fromInput = (input: BlogInput) => ({ subject: input.subject, html: input.html, tags: input.tags, publishState: input.publishState });

export function createMockBlogApi(): BlogApi {
	return {
		getBlogAccess: () => wait({ canCreate: true }),
		getBlogEntries: (filter, limit) => {
			const found = entries
				.filter((e) => (!filter.userId || e.userId === filter.userId) && (!filter.tag || e.tags.includes(filter.tag)))
				.sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));
			return wait({ entries: found.slice(0, limit), total: found.length });
		},
		addBlogEntry: (input) => {
			const id = nextId++;
			entries.push({ id, userId: 1, author: "Tomas", created: new Date().toISOString(), attachments: [], canEdit: true, ...fromInput(input) });
			return wait(id);
		},
		updateBlogEntry: (entryId, input) => {
			const i = entries.findIndex((e) => e.id === entryId);
			if (i >= 0) entries[i] = { ...entries[i], ...fromInput(input), modified: new Date().toISOString() };
			return wait(undefined);
		},
		deleteBlogEntry: (entryId) => {
			const i = entries.findIndex((e) => e.id === entryId);
			if (i >= 0) entries.splice(i, 1);
			return wait(undefined);
		},
	};
}
