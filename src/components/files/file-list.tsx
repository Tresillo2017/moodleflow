"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { FileViewer } from "@/components/files/file-viewer";
import { fileKind } from "@/lib/file-kind";
import { cn } from "@/lib/utils";
import type { MoodleFile } from "@/types/moodle";

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileList({ files, className }: { files: MoodleFile[]; className?: string }) {
	const { client } = useMoodleConnection();
	const [viewing, setViewing] = useState<MoodleFile | null>(null);
	if (!client) return null;
	const rowClass =
		"group/file flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none";
	return (
		<ul className={cn("flex flex-col gap-1", className)}>
			{files.map((f) => {
				const previewable = fileKind(f.name, f.mimeType).type !== "other";
				const inner = (
					<>
						{previewable ? (
							<Eye className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
						) : (
							<Download className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
						)}
						<span className="flex-1 truncate">{f.name}</span>
						<span className="text-muted-foreground tabular-nums">{formatSize(f.size)}</span>
					</>
				);
				return (
					<li key={f.url}>
						{previewable ? (
							<button type="button" onClick={() => setViewing(f)} className={rowClass}>
								{inner}
							</button>
						) : (
							<a href={client.fileUrl(f.url)} download={f.name} className={rowClass}>
								{inner}
							</a>
						)}
					</li>
				);
			})}
			{viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}
		</ul>
	);
}
