"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichContent } from "@/components/content/rich-content";
import { FileList } from "@/components/files/file-list";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { cn } from "@/lib/utils";
import type { MoodleActivity, MoodleFile } from "@/types/moodle";

/** Directory of a pluginfile URL, so relative/@@PLUGINFILE@@ references in served HTML resolve next to it. */
const dirOf = (url: string) => url.slice(0, url.lastIndexOf("/"));

/** Fetches a Moodle-served HTML file (page content, book chapter) with the user's token. */
function useHtmlFile(file: MoodleFile | undefined): { html?: string; error: boolean } {
	const { client } = useMoodleConnection();
	const [result, setResult] = useState<{ url?: string; html?: string; error: boolean }>({ error: false });
	useEffect(() => {
		if (!client || !file) return;
		let cancelled = false;
		fetch(client.fileUrl(file.url, { download: false }))
			.then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
			.then((html) => !cancelled && setResult({ url: file.url, html, error: false }))
			.catch(() => !cancelled && setResult({ url: file.url, error: true }));
		return () => {
			cancelled = true;
		};
	}, [client, file]);
	// stale result for a previous file counts as loading
	return result.url === file?.url ? result : { error: false };
}

function Html({ file, className }: { file: MoodleFile | undefined; className?: string }) {
	const { html, error } = useHtmlFile(file);
	if (!file || error) return <p className="p-6 text-sm text-muted-foreground">Couldn&apos;t load this content. Open it in Moodle instead.</p>;
	if (html === undefined) {
		return (
			<div className="flex justify-center p-6 text-muted-foreground">
				<Loader2 className="size-5 animate-spin" aria-label="Loading" />
			</div>
		);
	}
	return <RichContent html={html} pluginfileBase={dirOf(file.url)} className={className} />;
}

function BookBody({ activity }: { activity: MoodleActivity }) {
	const chapters = activity.chapters ?? [];
	const [index, setIndex] = useState(0);
	const files = activity.files ?? [];
	const chapter = chapters[index];
	// chapter hrefs look like "12/index.html"; the matching file's path is "/12/"
	const file = chapter && files.find((f) => f.path === `/${chapter.href.split("/")[0]}/`);
	const nav = "rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent";

	return (
		<div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
			<nav aria-label="Chapters" className="flex flex-col gap-0.5 overflow-y-auto">
				{chapters.map((c, i) => (
					<button
						key={c.href}
						type="button"
						aria-current={i === index ? "true" : undefined}
						onClick={() => setIndex(i)}
						style={{ paddingLeft: `${0.5 + c.level * 0.75}rem` }}
						className={cn(
							"rounded-md py-1.5 pr-2 text-left text-sm transition-colors hover:bg-muted/60",
							i === index && "bg-muted font-medium",
						)}
					>
						{c.title}
					</button>
				))}
			</nav>
			<div className="flex min-h-0 flex-col rounded-lg border bg-muted/30">
				<div className="min-h-0 flex-1 overflow-y-auto">
					<Html file={file} className="p-6" />
				</div>
				<div className="flex justify-between border-t p-2">
					<button type="button" className={nav} disabled={index === 0} onClick={() => setIndex(index - 1)}>
						← Previous
					</button>
					<button type="button" className={nav} disabled={index >= chapters.length - 1} onClick={() => setIndex(index + 1)}>
						Next →
					</button>
				</div>
			</div>
		</div>
	);
}

/** Groups folder files by their directory so nested folders read as headed lists. */
function FolderBody({ files }: { files: MoodleFile[] }) {
	const groups = Map.groupBy(files, (f) => f.path ?? "/");
	return (
		<div className="flex flex-col gap-4 overflow-y-auto">
			{[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([path, group]) => (
				<section key={path}>
					{path !== "/" && <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{path.replace(/^\/|\/$/g, "").replaceAll("/", " / ")}</h3>}
					<FileList files={group} />
				</section>
			))}
		</div>
	);
}

/** In-app reader for page, book and folder activities (built from core_course_get_contents; no extra web services). */
export function ActivityViewer({ activity, onClose }: { activity: MoodleActivity; onClose: () => void }) {
	return (
		<Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
			<DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-3 sm:max-w-5xl">
				<DialogHeader className="pr-8">
					<DialogTitle className="truncate text-sm">{activity.name}</DialogTitle>
				</DialogHeader>
				{activity.type === "book" ? (
					<BookBody activity={activity} />
				) : activity.type === "folder" ? (
					<FolderBody files={activity.files ?? []} />
				) : (
					<div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/30">
						<Html file={activity.files?.[0]} className="p-6" />
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

export const hasViewer = (a: MoodleActivity) => a.type === "page" || a.type === "book" || a.type === "folder";
