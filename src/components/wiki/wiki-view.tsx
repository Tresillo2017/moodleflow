"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Plus } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { RichContent } from "@/components/content/rich-content";
import { TitledEditor } from "@/components/ui/titled-editor";
import { Button } from "@/components/ui/button";
import { FileList } from "@/components/files/file-list";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { toast } from "@/lib/toast";
import { wikiLinkPageId } from "@/lib/moodle/normalize-wiki";
import { cn } from "@/lib/utils";
import type { Subwiki, Wiki, WikiEditing } from "@/types/wiki";

const subwikiLabel = (s: Subwiki, i: number) => (s.userId ? `User ${s.userId}` : s.groupId ? `Group ${s.groupId}` : i === 0 ? "Everyone" : `Wiki ${i + 1}`);

function PageBody({ pageId, canEdit, onNavigate }: { pageId: number; canEdit: boolean; onNavigate: (id: number) => void }) {
	const { client, refresh } = useMoodleConnection();
	const query = useMoodleQuery(client ? () => client.getWikiPage(pageId) : null, [client, pageId]);
	const [editing, setEditing] = useState<WikiEditing | null>(null);
	const [opening, setOpening] = useState(false);

	// editing a page locks it in Moodle, so it only opens on request and fails loudly when someone else holds it
	async function startEditing() {
		if (!client) return;
		setOpening(true);
		try {
			const draft = await client.getWikiPageForEditing(pageId);
			if (draft.format !== "html") toast.error("This page uses a markup format that can only be edited in Moodle.");
			else setEditing(draft);
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't open the page for editing. Someone else may be editing it.");
		} finally {
			setOpening(false);
		}
	}
	useEffect(() => {
		void client?.logWikiPageView(pageId);
	}, [client, pageId]);

	if (query.loading) return <ListSkeleton rows={3} />;
	if (query.error) return <ErrorState error={query.error} onRetry={refresh} />;
	const page = query.data;
	if (!page) return null;
	if (editing) {
		return (
			<TitledEditor
				initialHtml={editing.content}
				contentLabel="Page content"
				submitLabel="Save page"
				onCancel={() => setEditing(null)}
				onSubmit={async (_title, html) => {
					await client?.saveWikiPage(pageId, html);
					setEditing(null);
					toast.success("Page saved");
					refresh();
				}}
			/>
		);
	}
	return (
		<article className="flex flex-col gap-3 rounded-xl border bg-card p-5">
			<div className="flex items-start justify-between gap-3">
				<h2>{page.title}</h2>
				{canEdit && page.canEdit && (
					<Button variant="outline" size="sm" onClick={() => void startEditing()} disabled={opening}>
						<Pencil aria-hidden="true" />
						Edit
					</Button>
				)}
			</div>
			{/* wiki-internal links open in the app instead of Moodle */}
			<div
				onClick={(e) => {
					const target = (e.target as HTMLElement).closest("a");
					const id = wikiLinkPageId(target?.getAttribute("href"));
					if (!id) return;
					e.preventDefault();
					onNavigate(id);
				}}
			>
				<RichContent html={page.html || "<p><em>This page is empty.</em></p>"} />
			</div>
		</article>
	);
}

/** Reads a wiki: pick a subwiki (class, group or user), browse its pages, follow wiki links, see attached files. */
export function WikiView({ wiki }: { wiki: Wiki }) {
	const { client, refresh } = useMoodleConnection();
	const subwikis = useMoodleQuery(client ? () => client.getSubwikis(wiki.id) : null, [client, wiki.id]);
	const [subwikiId, setSubwikiId] = useState<number | null>(null);
	const [pageId, setPageId] = useState<number | null>(null);
	const [creating, setCreating] = useState(false);
	const subwiki = subwikis.data?.find((s) => s.id === subwikiId) ?? subwikis.data?.[0];

	const pages = useMoodleQuery(client && subwiki ? () => client.getWikiPages(wiki, subwiki) : null, [client, wiki.id, subwiki?.id]);
	const files = useMoodleQuery(client && subwiki ? () => client.getWikiFiles(subwiki) : null, [client, subwiki?.id]);
	const current = useMemo(() => pages.data?.find((p) => p.id === pageId) ?? pages.data?.[0], [pages.data, pageId]);

	if (subwikis.loading || pages.loading) return <ListSkeleton rows={4} />;
	const error = subwikis.error ?? pages.error;
	if (error) return <ErrorState error={error} onRetry={refresh} />;
	if (!subwiki || !current) return <EmptyState icon={FileText} title="No pages yet" description="This wiki doesn't have any pages." />;

	return (
		<div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
			<nav aria-label="Wiki pages" className="flex flex-col gap-1 lg:sticky lg:top-20 lg:self-start">
				{subwikis.data && subwikis.data.length > 1 && (
					<select
						aria-label="Wiki"
						value={subwiki.id}
						onChange={(e) => {
							setSubwikiId(Number(e.target.value));
							setPageId(null);
						}}
						className="mb-2 rounded-lg border bg-card px-2 py-1.5 text-sm"
					>
						{subwikis.data.map((s, i) => (
							<option key={s.id} value={s.id}>
								{subwikiLabel(s, i)}
							</option>
						))}
					</select>
				)}
				<p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Pages</p>
				{subwiki.canEdit && (
					<Button variant="outline" size="sm" className="mb-1 w-full justify-start" onClick={() => setCreating(true)}>
						<Plus aria-hidden="true" />
						New page
					</Button>
				)}
				{pages.data?.map((p) => (
					<button
						key={p.id}
						type="button"
						onClick={() => {
							setPageId(p.id);
							setCreating(false);
						}}
						aria-current={p.id === current.id ? "page" : undefined}
						className={cn(
							"rounded-lg border-l-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
							p.id === current.id ? "border-primary bg-muted/70 font-medium text-foreground" : "border-transparent text-muted-foreground",
						)}
					>
						{p.title}
					</button>
				))}
			</nav>
			<div className="flex min-w-0 flex-col gap-4">
				{creating ? (
					<TitledEditor
						initialTitle=""
						titleLabel="Page title"
						contentLabel="Page content"
						submitLabel="Create page"
						onCancel={() => setCreating(false)}
						onSubmit={async (title, html) => {
							const id = await client?.createWikiPage(subwiki, title, html);
							setCreating(false);
							if (id) setPageId(id);
							toast.success("Page created");
							refresh();
						}}
					/>
				) : (
					<PageBody key={current.id} pageId={current.id} canEdit={subwiki.canEdit} onNavigate={setPageId} />
				)}
				{files.data && files.data.length > 0 && (
					<section className="flex flex-col gap-2">
						<h3 className="text-sm font-semibold">Files</h3>
						<FileList files={files.data} />
					</section>
				)}
			</div>
		</div>
	);
}
