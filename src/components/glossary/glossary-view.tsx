"use client";

import { useEffect, useState } from "react";
import { BookA, Pencil, Plus, Trash2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { Comments } from "@/components/collab/comments";
import { RatingWidget } from "@/components/collab/rating-widget";
import { RichContent } from "@/components/content/rich-content";
import { Button } from "@/components/ui/button";
import { TitledEditor } from "@/components/ui/titled-editor";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { toast } from "@/lib/toast";
import { useSupports } from "@/hooks/use-supports";
import { formatDistanceToNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GLOSSARY_ALL_CATEGORIES, GLOSSARY_NOT_CATEGORISED } from "@/types/glossary";
import type { ItemRating } from "@/types/collab";
import type { Glossary, GlossaryBrowseMode, GlossaryEntry, GlossaryQuery } from "@/types/glossary";

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;
const LETTERS = ["ALL", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), "SPECIAL"];
const MODE_LABEL: Record<GlossaryBrowseMode, string> = { letter: "A–Z", category: "Category", author: "Author", date: "Newest" };

function EntryCard({ glossary, entry, rating, canUpdate, canRemove, onChanged }: { glossary: Glossary; entry: GlossaryEntry; rating?: ItemRating; canUpdate: boolean; canRemove: boolean; onChanged: () => void }) {
	const { client } = useMoodleConnection();
	const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");

	async function remove() {
		try {
			await client?.deleteGlossaryEntry(entry.id);
			toast.success("Entry deleted");
			onChanged();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't delete that entry.");
			setMode("view");
		}
	}

	if (mode === "edit") {
		return (
			<TitledEditor
				initialTitle={entry.concept}
				initialHtml={entry.definition}
				titleLabel="Concept"
				contentLabel="Definition"
				submitLabel="Save entry"
				onCancel={() => setMode("view")}
				onSubmit={async (concept, html) => {
					await client?.updateGlossaryEntry(entry.id, concept, html);
					setMode("view");
					toast.success("Entry saved");
					onChanged();
				}}
			/>
		);
	}
	return (
		<article className="flex flex-col gap-1 rounded-xl border bg-card p-4">
			<h3 className="text-base font-semibold">{entry.concept}</h3>
			<RichContent html={entry.definition} />
			<p className="text-xs text-muted-foreground">
				{entry.author}
				{(entry.modified ?? entry.created) && ` · ${formatDistanceToNow((entry.modified ?? entry.created)!)}`}
				{!entry.approved && " · awaiting approval"}
			</p>
			{(rating || (entry.canEdit && canUpdate) || (entry.canDelete && canRemove)) && (
				<footer className="flex items-center gap-1 pt-1">
					{entry.canEdit && canUpdate && (
						<Button variant="ghost" size="xs" onClick={() => setMode("edit")}>
							<Pencil aria-hidden="true" />
							Edit
						</Button>
					)}
					{entry.canDelete && canRemove && mode === "view" && (
						<Button variant="ghost" size="xs" onClick={() => setMode("confirm-delete")}>
							<Trash2 aria-hidden="true" />
							Delete
						</Button>
					)}
					{mode === "confirm-delete" && (
						<>
							<Button variant="destructive" size="xs" onClick={() => void remove()}>
								Delete entry
							</Button>
							<Button variant="ghost" size="xs" onClick={() => setMode("view")}>
								Keep
							</Button>
						</>
					)}
					<span className="ml-auto">
						<RatingWidget
							rating={rating}
							label="Rate this entry"
							onRate={async (value) => {
								if (!client || !rating) return;
								await client.rateItem({ cmid: glossary.cmid, component: "mod_glossary", area: "entry", itemId: entry.id, authorId: entry.userId, scaleId: rating.scaleId, aggregation: glossary.assessed }, value);
								onChanged();
							}}
						/>
					</span>
				</footer>
			)}
			{glossary.allowComments && <Comments target={{ contextLevel: "module", instanceId: glossary.cmid, component: "mod_glossary", area: "glossary_entry", itemId: entry.id }} />}
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
	const [adding, setAdding] = useState(false);
	// older Moodle sites can add entries but not edit or delete them
	const canAdd = useSupports("mod_glossary_add_entry") && glossary.canAddEntry;
	const canUpdate = useSupports("mod_glossary_update_entry");
	const canRemove = useSupports("mod_glossary_delete_entry");

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
				{canAdd && !adding && (
					<Button variant="outline" size="sm" onClick={() => setAdding(true)}>
						<Plus aria-hidden="true" />
						Add entry
					</Button>
				)}
				<SearchInput value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search the glossary" aria-label="Search the glossary" className="w-full sm:ml-auto sm:w-64" />
			</div>

			{adding && (
				<TitledEditor
					initialTitle=""
					titleLabel="Concept"
					contentLabel="Definition"
					submitLabel="Add entry"
					onCancel={() => setAdding(false)}
					onSubmit={async (concept, html) => {
						await client?.addGlossaryEntry(glossary.id, concept, html);
						setAdding(false);
						toast.success("Entry added", { description: "It may need a teacher's approval before others see it." });
						refresh();
					}}
				/>
			)}

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
							<EntryCard key={e.id} glossary={glossary} entry={e} rating={page.data!.ratings[e.id]} canUpdate={canUpdate} canRemove={canRemove} onChanged={refresh} />
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
