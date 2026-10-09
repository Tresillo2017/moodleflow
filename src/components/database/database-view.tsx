"use client";

import { useEffect, useState } from "react";
import { Database as DatabaseIcon, Plus } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useSupports } from "@/hooks/use-supports";
import { EntryCard } from "@/components/database/entry-card";
import { EntryForm } from "@/components/database/entry-form";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { toast } from "@/lib/toast";
import type { Database } from "@/types/database";

const PAGE_SIZE = 12;
const SEARCH_DELAY_MS = 300;

/** Browses, searches and (where allowed) adds, edits, deletes and approves the entries of a database activity. */
export function DatabaseView({ database }: { database: Database }) {
	const { client, refresh } = useMoodleConnection();
	const [typed, setTyped] = useState("");
	const [search, setSearch] = useState("");
	const [limit, setLimit] = useState(PAGE_SIZE);
	const [adding, setAdding] = useState(false);
	const canAddEntry = useSupports("mod_data_add_entry");
	const canUpdate = useSupports("mod_data_update_entry");
	const canRemove = useSupports("mod_data_delete_entry");

	useEffect(() => {
		const t = setTimeout(() => setSearch(typed.trim()), SEARCH_DELAY_MS);
		return () => clearTimeout(t);
	}, [typed]);
	useEffect(() => setLimit(PAGE_SIZE), [search]);
	useEffect(() => {
		void client?.logDatabaseView(database.id);
	}, [client, database.id]);

	const fields = useMoodleQuery(client ? () => client.getDatabaseFields(database.id) : null, [client, database.id]);
	const access = useMoodleQuery(client ? () => client.getDatabaseAccess(database.id) : null, [client, database.id]);
	// ponytail: refetches everything up to `limit` on "Show more"; fine for databases of a few hundred entries
	const page = useMoodleQuery(client ? () => client.getDatabaseEntries(database.id, search, limit) : null, [client, database.id, search, limit]);

	const error = fields.error ?? page.error;
	const canAdd = canAddEntry && Boolean(access.data?.canAdd);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				{canAdd && !adding && (
					<Button variant="outline" size="sm" onClick={() => setAdding(true)}>
						<Plus aria-hidden="true" />
						Add entry
					</Button>
				)}
				<SearchInput value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search entries" aria-label="Search entries" className="w-full sm:ml-auto sm:w-64" />
			</div>

			{adding && fields.data && (
				<EntryForm
					fields={fields.data}
					submitLabel="Add entry"
					onCancel={() => setAdding(false)}
					onSubmit={async (data) => {
						await client?.addDatabaseEntry(database.id, data);
						setAdding(false);
						toast.success("Entry added", database.requiresApproval ? { description: "It will show for others once a teacher approves it." } : undefined);
						refresh();
					}}
				/>
			)}

			{(page.loading || fields.loading) && <ListSkeleton rows={3} />}
			{error && <ErrorState error={error} onRetry={refresh} />}
			{fields.data && page.data && page.data.entries.length === 0 && (
				<EmptyState icon={DatabaseIcon} title={search ? "No matching entries" : "No entries yet"} description={search ? `Nothing matches “${search}”.` : "Entries added to this database show up here."} />
			)}
			{fields.data && page.data && page.data.entries.length > 0 && access.data && (
				<>
					<p className="text-xs text-muted-foreground tabular-nums">
						{page.data.total} {page.data.total === 1 ? "entry" : "entries"}
					</p>
					<div className="flex flex-col gap-3">
						{page.data.entries.map((e) => (
							<EntryCard key={e.id} database={database} entry={e} rating={page.data!.ratings[e.id]} fields={fields.data!} access={access.data!} canUpdate={canUpdate} canRemove={canRemove} onChanged={refresh} />
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
