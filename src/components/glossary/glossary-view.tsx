"use client";

import { useEffect, useState } from "react";
import { BookA } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { RichContent } from "@/components/content/rich-content";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { formatDistanceToNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GLOSSARY_ALL_CATEGORIES, GLOSSARY_NOT_CATEGORISED } from "@/types/glossary";
import type { Glossary, GlossaryBrowseMode, GlossaryEntry, GlossaryQuery } from "@/types/glossary";

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;
const LETTERS = ["ALL", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), "SPECIAL"];
const MODE_LABEL: Record<GlossaryBrowseMode, string> = { letter: "A–Z", category: "Category", author: "Author", date: "Newest" };

function EntryCard({ entry }: { entry: GlossaryEntry }) {
	return (
		<article className="flex flex-col gap-1 rounded-xl border bg-card p-4">
			<h3 className="text-base font-semibold">{entry.concept}</h3>
			<RichContent html={entry.definition} />
			<p className="text-xs text-muted-foreground">
				{entry.author}
				{(entry.modified ?? entry.created) && ` · ${formatDistanceToNow((entry.modified ?? entry.created)!)}`}
				{!entry.approved && " · awaiting approval"}
			</p>
		</article>
	);
}

function Chips<T extends string | number>({ label, items, value, onPick }: { label: string; items: { id: T; text: string }[]; value: T; onPick: (id: T) => void }) {
	return (
		<div role="group" aria-label={label} className="flex flex-wrap gap-1">
			{items.map((i) => (
				<button
					key={i.id}
					type="button"
					aria-pressed={i.id === value}
					onClick={() => onPick(i.id)}
					className={cn(
						"rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/60 focus-visible:outline-2",
						i.id === value ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
					)}
				>
					{i.text}
				</button>
			))}
		</div>
	);
}

/** Browses a glossary by letter, category, author or date, and searches it. */
export function GlossaryView({ glossary }: { glossary: Glossary }) {
	const { client, refresh } = useMoodleConnection();
	const [mode, setMode] = useState<GlossaryBrowseMode>(glossary.browseModes[0] ?? "letter");
	const [letter, setLetter] = useState("ALL");
	const [categoryId, setCategoryId] = useState(GLOSSARY_ALL_CATEGORIES);
	const [typed, setTyped] = useState("");
	const [text, setText] = useState("");
	const [limit, setLimit] = useState(PAGE_SIZE);

	useEffect(() => {
		const t = setTimeout(() => setText(typed.trim()), SEARCH_DELAY_MS);
		return () => clearTimeout(t);
	}, [typed]);
	useEffect(() => {
		void client?.logGlossaryView(glossary.id);
	}, [client, glossary.id]);

	const query: GlossaryQuery = text ? { mode: "search", text } : mode === "letter" ? { mode, letter } : mode === "category" ? { mode, categoryId } : { mode };
	const key = JSON.stringify(query);
	// a new query starts from the first page again
	useEffect(() => setLimit(PAGE_SIZE), [key]);

	const categories = useMoodleQuery(client && mode === "category" ? () => client.getGlossaryCategories(glossary.id) : null, [client, glossary.id, mode]);
	// ponytail: refetches everything up to `limit` on "Show more"; fine for glossaries of a few hundred entries
	const page = useMoodleQuery(client ? () => client.getGlossaryEntries(glossary.id, query, limit) : null, [client, glossary.id, key, limit]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				{glossary.browseModes.length > 1 && !text && (
					<div role="group" aria-label="Browse by" className="flex gap-1 rounded-lg bg-muted/50 p-1">
						{glossary.browseModes.map((m) => (
							<Button key={m} size="sm" variant={m === mode ? "secondary" : "ghost"} aria-pressed={m === mode} onClick={() => setMode(m)}>
								{MODE_LABEL[m]}
							</Button>
						))}
					</div>
				)}
				<SearchInput value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search the glossary" aria-label="Search the glossary" className="w-full sm:ml-auto sm:w-64" />
			</div>

			{!text && mode === "letter" && <Chips label="Letter" value={letter} onPick={setLetter} items={LETTERS.map((l) => ({ id: l, text: l === "ALL" ? "All" : l === "SPECIAL" ? "#" : l }))} />}
			{!text && mode === "category" && categories.data && (
				<Chips
					label="Category"
					value={categoryId}
					onPick={setCategoryId}
					items={[{ id: GLOSSARY_ALL_CATEGORIES, text: "All" }, ...categories.data.map((c) => ({ id: c.id, text: c.name })), { id: GLOSSARY_NOT_CATEGORISED, text: "Not categorised" }]}
				/>
			)}

			{page.loading && <ListSkeleton rows={3} />}
			{page.error && <ErrorState error={page.error} onRetry={refresh} />}
			{page.data && page.data.entries.length === 0 && (
				<EmptyState icon={BookA} title={text ? "No matching entries" : "No entries here"} description={text ? `Nothing matches “${text}”.` : "Nothing has been added under this selection yet."} />
			)}
			{page.data && page.data.entries.length > 0 && (
				<>
					<p className="text-xs text-muted-foreground tabular-nums">
						{page.data.total} {page.data.total === 1 ? "entry" : "entries"}
					</p>
					<div className="flex flex-col gap-3">
						{page.data.entries.map((e) => (
							<EntryCard key={e.id} entry={e} />
						))}
					</div>
					{page.data.entries.length < page.data.total && (
						<Button variant="outline" className="self-center" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
							Show more
						</Button>
					)}
				</>
			)}
		</div>
	);
}
