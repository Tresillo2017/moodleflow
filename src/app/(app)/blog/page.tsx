"use client";

import { useEffect, useState } from "react";
import { NotebookPen, Plus, X } from "lucide-react";
import { BlogEditor } from "@/components/blog/blog-editor";
import { BlogEntryCard } from "@/components/blog/blog-entry-card";
import { PageHeader } from "@/components/layout/page-header";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useSupports } from "@/hooks/use-supports";
import { toast } from "@/lib/toast";
import type { BlogFilter } from "@/types/blog";

const PAGE_SIZE = 10;
const EVERYONE = "all";
const MINE = "mine";

function BlogContent() {
	const { client, refresh } = useMoodleConnection();
	const canAddEntry = useSupports("core_blog_add_entry");
	const [scope, setScope] = useState(EVERYONE); // "all", "mine" or a course id
	const [tag, setTag] = useState<string | null>(null);
	const [limit, setLimit] = useState(PAGE_SIZE);
	const [adding, setAdding] = useState(false);

	const me = useMoodleQuery(client ? () => client.getSiteInfo() : null, [client]).data?.userId;
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]).data ?? [];
	const access = useMoodleQuery(client ? () => client.getBlogAccess() : null, [client]).data;

	const filter: BlogFilter = { ...(scope === MINE ? { userId: me } : scope === EVERYONE ? {} : { courseId: Number(scope) }), ...(tag ? { tag } : {}) };
	const key = JSON.stringify(filter);
	useEffect(() => setLimit(PAGE_SIZE), [key]);
	// ponytail: refetches everything up to `limit` on "Show more"; fine for a few hundred entries
	const page = useMoodleQuery(client && (scope !== MINE || me) ? () => client.getBlogEntries(filter, limit) : null, [client, key, limit, me]);

	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="Blog" description="Write down what you learn, and read what others share." />
			<div className="flex flex-wrap items-center gap-3">
				<select aria-label="Whose entries" value={scope} onChange={(e) => setScope(e.target.value)} className="h-9 rounded-lg border bg-card px-2 text-sm">
					<option value={EVERYONE}>Everyone</option>
					<option value={MINE}>My entries</option>
					{courses.map((c) => (
						<option key={c.id} value={c.id}>
							{c.shortName}
						</option>
					))}
				</select>
				{tag && (
					<Button variant="secondary" size="sm" onClick={() => setTag(null)}>
						#{tag}
						<X aria-label="Clear tag filter" />
					</Button>
				)}
				{canAddEntry && access?.canCreate && !adding && (
					<Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => setAdding(true)}>
						<Plus aria-hidden="true" />
						New entry
					</Button>
				)}
			</div>

			{adding && (
				<BlogEditor
					submitLabel="Publish entry"
					onCancel={() => setAdding(false)}
					onSubmit={async (input) => {
						await client?.addBlogEntry(input);
						setAdding(false);
						toast.success("Entry saved");
						refresh();
					}}
				/>
			)}

			{page.loading && <ListSkeleton rows={3} />}
			{page.error && <ErrorState error={page.error} onRetry={refresh} />}
			{page.data && page.data.entries.length === 0 && (
				<EmptyState icon={NotebookPen} title="No entries" description={tag ? `Nothing is tagged #${tag} here.` : "Nothing has been written here yet."} />
			)}
			{page.data && page.data.entries.length > 0 && (
				<>
					<div className="flex flex-col gap-4">
						{page.data.entries.map((e) => (
							<BlogEntryCard key={e.id} entry={e} onTag={setTag} onChanged={refresh} />
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

export default function BlogPage() {
	return (
		<FeatureGate feature="Blog" functions={["core_blog_get_entries"]}>
			<BlogContent />
		</FeatureGate>
	);
}
