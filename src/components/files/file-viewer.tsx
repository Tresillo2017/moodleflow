"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { fileKind } from "@/lib/file-kind";
import type { MoodleFile } from "@/types/moodle";

const MAX_CODE_CHARS = 1_000_000;

type Loaded =
	| { status: "loading" }
	| { status: "error" }
	| { status: "blob"; url: string }
	| { status: "code"; html: string; truncated: boolean };

function useFileContent(file: MoodleFile): Loaded {
	const { client } = useMoodleConnection();
	const { resolvedTheme } = useTheme();
	const [state, setState] = useState<Loaded>({ status: "loading" });

	useEffect(() => {
		const kind = fileKind(file.name, file.mimeType);
		if (!client || kind.type === "other") return;
		let cancelled = false;
		let objectUrl: string | undefined;
		setState({ status: "loading" });

		(async () => {
			try {
				// no forcedownload: the viewer wants the bytes, not an attachment
				const res = await fetch(client.fileUrl(file.url, { download: false }));
				if (!res.ok) throw new Error(String(res.status));
				if (kind.type === "code") {
					const text = await res.text();
					const truncated = text.length > MAX_CODE_CHARS;
					const { codeToHtml } = await import("shiki");
					const html = await codeToHtml(truncated ? text.slice(0, MAX_CODE_CHARS) : text, {
						lang: kind.lang,
						theme: resolvedTheme === "light" ? "github-light" : "github-dark",
					});
					if (!cancelled) setState({ status: "code", html, truncated });
				} else {
					const blob = await res.blob();
					// force the right type so the browser's PDF/image viewer kicks in
					const typed = new Blob([blob], { type: kind.type === "pdf" ? "application/pdf" : blob.type });
					objectUrl = URL.createObjectURL(typed);
					if (!cancelled) setState({ status: "blob", url: objectUrl });
				}
			} catch {
				if (!cancelled) setState({ status: "error" });
			}
		})();

		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [client, file.url, file.name, file.mimeType, resolvedTheme]);

	return state;
}

function Body({ file, state }: { file: MoodleFile; state: Loaded }) {
	const kind = fileKind(file.name, file.mimeType);
	if (state.status === "loading") {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				<Loader2 className="size-5 animate-spin" aria-label="Loading preview" />
			</div>
		);
	}
	if (state.status === "error") {
		return (
			<p className="p-6 text-sm text-muted-foreground">
				Couldn&apos;t preview this file. Your Moodle site may block it — use Download instead.
			</p>
		);
	}
	if (state.status === "code") {
		return (
			<div className="h-full overflow-auto">
				{/* shiki escapes the source, so its HTML output is safe to inject */}
				<div
					className="text-xs [&_pre]:min-h-full [&_pre]:p-4 [&_pre]:leading-relaxed"
					dangerouslySetInnerHTML={{ __html: state.html }}
				/>
				{state.truncated && (
					<p className="border-t px-4 py-2 text-xs text-muted-foreground">Preview truncated — download for the full file.</p>
				)}
			</div>
		);
	}
	return kind.type === "pdf" ? (
		<iframe src={state.url} title={file.name} className="h-full w-full border-0" />
	) : (
		// eslint-disable-next-line @next/next/no-img-element
		<img src={state.url} alt={file.name} className="mx-auto max-h-full max-w-full object-contain p-4" />
	);
}

export function FileViewer({ file, onClose }: { file: MoodleFile; onClose: () => void }) {
	const { client } = useMoodleConnection();
	const state = useFileContent(file);

	return (
		<Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
			<DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-3 sm:max-w-5xl">
				<DialogHeader className="flex-row items-center justify-between gap-3 pr-8">
					<DialogTitle className="truncate text-sm">{file.name}</DialogTitle>
					{client && (
						<Button size="sm" variant="outline" nativeButton={false} render={<a href={client.fileUrl(file.url)} download={file.name} />}>
							<Download className="size-3.5" aria-hidden="true" />
							Download
						</Button>
					)}
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/30">
					<Body file={file} state={state} />
				</div>
			</DialogContent>
		</Dialog>
	);
}
