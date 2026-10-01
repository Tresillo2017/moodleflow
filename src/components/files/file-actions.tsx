"use client";

import { useState, type RefObject } from "react";
import { AppWindow, Bot, Printer, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { fileKind } from "@/lib/file-kind";
import {
	AI_ACTIONS,
	AI_PROVIDERS,
	IDES,
	aiLink,
	aiPrompt,
	appsFor,
	claudeCodeCommand,
	ideLink,
	type AiAction,
	type AiProvider,
} from "@/lib/open-in";
import { notebookToMarkdown } from "@/lib/preview";
import { readPersisted, writePersisted } from "@/lib/persist";
import { sanitizeMoodleHtml } from "@/lib/sanitize";
import { toast } from "@/lib/toast";
import type { MoodleFile } from "@/types/moodle";
import type { Loaded } from "@/components/files/file-viewer";

const DIR_KEY = "moodleflow.downloadDir";
const MAX_DOCX_BYTES = 15 * 1024 * 1024;
/** How long the browser gets to start the download before we fire the IDE link. */
const DOWNLOAD_SETTLE_MS = 1500;

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Prints `body` from a hidden iframe: scripts can't run in it (sandbox without allow-scripts). */
function printHtml(title: string, body: string) {
	const frame = document.createElement("iframe");
	frame.setAttribute("sandbox", "allow-same-origin allow-modals");
	frame.style.cssText = "position:fixed;width:0;height:0;border:0";
	// ponytail: code prints black-on-white without syntax colours (shiki's dark theme is unreadable on paper)
	frame.srcdoc = `<!doctype html><title>${escapeHtml(title)}</title><style>
		body{font:14px/1.5 system-ui,sans-serif;margin:1.5rem;color:#000}
		img{max-width:100%} table{border-collapse:collapse;font-size:12px} td{border:1px solid #ccc;padding:2px 6px}
		pre{white-space:pre-wrap;word-break:break-word;font-size:11px;background:none!important}
		pre,pre span{color:#000!important;background:none!important}</style>${body}`;
	frame.onload = () => {
		frame.contentWindow?.focus();
		frame.contentWindow?.print();
		setTimeout(() => frame.remove(), 60_000);
	};
	document.body.appendChild(frame);
}

function download(url: string, name: string) {
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();
}

export function FileActions({
	file,
	state,
	pdfFrame,
}: {
	file: MoodleFile;
	state: Loaded;
	pdfFrame: RefObject<HTMLIFrameElement | null>;
}) {
	const { client } = useMoodleConnection();
	const kind = fileKind(file.name, file.mimeType);
	const { ides, apps } = appsFor(kind);
	const isCode = kind.type === "code";
	const [dir, setDir] = useState(() => readPersisted(DIR_KEY) ?? "");
	const [askDir, setAskDir] = useState<((dir: string) => void) | null>(null);
	const [dirDraft, setDirDraft] = useState("");

	if (!client) return null;

	const downloadUrl = client.fileUrl(file.url);
	const canShare = typeof navigator !== "undefined" && "canShare" in navigator && navigator.canShare({ files: [new File([], file.name)] });

	const printable =
		state.status === "code" ||
		state.status === "html" ||
		state.status === "csv" ||
		(state.status === "blob" && (kind.type === "pdf" || kind.type === "image"));

	const print = () => {
		if (state.status === "code") printHtml(file.name, state.html);
		else if (state.status === "html")
			printHtml(file.name, sanitizeMoodleHtml(state.html, { fileUrl: (u) => client.fileUrl(u, { download: false }) }));
		else if (state.status === "csv")
			printHtml(
				file.name,
				`<table>${state.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</table>`,
			);
		else if (state.status === "blob" && kind.type === "image") printHtml(file.name, `<img src="${state.url}" alt="">`);
		else if (state.status === "blob") {
			try {
				pdfFrame.current?.contentWindow?.print();
			} catch {
				window.open(state.url, "_blank"); // viewer blocked scripted print; the browser's PDF tab can print
			}
		}
	};

	/** Text for the prompt, or undefined for binary files (the user attaches those). */
	async function readText(): Promise<string | undefined> {
		if (kind.type !== "code" && kind.type !== "markdown" && kind.type !== "csv" && kind.type !== "notebook" && kind.type !== "docx") return;
		const res = await fetch(client!.fileUrl(file.url, { download: false }));
		if (!res.ok) throw new Error(String(res.status));
		if (kind.type === "docx") {
			const buffer = await res.arrayBuffer();
			if (buffer.byteLength > MAX_DOCX_BYTES) return;
			const mammoth = (await import("mammoth/mammoth.browser")).default;
			return (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
		}
		const text = await res.text();
		return kind.type === "notebook" ? notebookToMarkdown(text) : text;
	}

	async function askAi(action: AiAction, provider: AiProvider) {
		// open synchronously (the click is the user gesture), point it at the prompt once the file is read
		const tab = window.open("about:blank", "_blank");
		if (!tab) return void toast.error("Your browser blocked the new tab");
		tab.opener = null;
		try {
			const text = await readText();
			const { text: prompt, fits } = aiPrompt(action, { name: file.name, text });
			const needsClipboard = !fits || provider === "gemini";
			if (needsClipboard) await navigator.clipboard.writeText(prompt);
			const linkPrompt = fits ? prompt : `${AI_ACTIONS[action].ask}. The file is on my clipboard, I'll paste it below.`;
			tab.location.href = aiLink(provider, linkPrompt);
			if (needsClipboard) toast.info(`Copied — paste it into ${AI_PROVIDERS[provider].label}`);
			else if (text === undefined) {
				download(downloadUrl, file.name);
				toast.info(`Attach ${file.name} in ${AI_PROVIDERS[provider].label}`, { description: "Downloaded for you to attach." });
			}
		} catch {
			tab.close();
			toast.error("Couldn't read this file for the AI prompt");
		}
	}

	async function claudeCode() {
		const prompt = `${AI_ACTIONS[isCode ? "review" : "explain"].ask}. The file is ${file.name} in the current folder.`;
		try {
			await navigator.clipboard.writeText(claudeCodeCommand(prompt, dir || undefined));
		} catch {
			return void toast.error("Couldn't copy to the clipboard");
		}
		download(downloadUrl, file.name);
		toast.info("Command copied — run it in a terminal", {
			description: dir ? undefined : "Run it in the folder the file downloaded to.",
		});
	}

	const openInIde = (ide: (typeof IDES)[number]) => {
		const go = (folder: string) => {
			download(downloadUrl, file.name);
			// ponytail: fixed delay; breaks if the download is slow or the browser renames duplicates ("a (1).py")
			setTimeout(() => (window.location.href = ideLink(ide, folder, file.name)), DOWNLOAD_SETTLE_MS);
		};
		if (dir) go(dir);
		else openDirDialog(go);
	};

	const openDirDialog = (then?: (dir: string) => void) => {
		setDirDraft(dir);
		setAskDir(() => (saved: string) => {
			setDir(saved);
			writePersisted(DIR_KEY, saved);
			then?.(saved);
		});
	};

	const hintApp = (app: string) => {
		download(downloadUrl, file.name);
		toast.info(`Downloaded — open it with ${app}`, { description: dir ? `In ${dir}` : "From your downloads folder." });
	};

	const share = async () => {
		try {
			const res = await fetch(client.fileUrl(file.url, { download: false }));
			if (!res.ok) throw new Error(String(res.status));
			await navigator.share({ files: [new File([await res.blob()], file.name, { type: file.mimeType })] });
		} catch (e) {
			if (!(e instanceof DOMException && e.name === "AbortError")) toast.error("Couldn't share this file");
		}
	};

	return (
		<>
			{printable && (
				<Button size="sm" variant="outline" onClick={print}>
					<Printer className="size-3.5" aria-hidden="true" />
					<span className="max-sm:hidden">Print</span>
				</Button>
			)}

			<DropdownMenu>
				<DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
					<Sparkles className="size-3.5" aria-hidden="true" />
					<span className="max-sm:hidden">Ask AI</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-52" align="end">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Open with prefilled prompt</DropdownMenuLabel>
					{(Object.keys(AI_ACTIONS) as AiAction[])
						.filter((a) => a !== "review" || isCode)
						.map((action) => (
							<DropdownMenuSub key={action}>
								<DropdownMenuSubTrigger>{AI_ACTIONS[action].label}</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									{(Object.keys(AI_PROVIDERS) as AiProvider[]).map((p) => (
										<DropdownMenuItem key={p} onClick={() => askAi(action, p)}>
											<Bot aria-hidden="true" />
											{AI_PROVIDERS[p].label}
										</DropdownMenuItem>
									))}
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						))}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={claudeCode}>
						<Terminal aria-hidden="true" />
						Claude Code (copy command)
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{(ides || apps.length > 0 || canShare) && (
				<DropdownMenu>
					<DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
						<AppWindow className="size-3.5" aria-hidden="true" />
						<span className="max-sm:hidden">Open in…</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-56" align="end">
						{ides && (
							<DropdownMenuGroup>
								<DropdownMenuLabel>Download, then open in</DropdownMenuLabel>
								{IDES.map((ide) => (
									<DropdownMenuItem key={ide.id} onClick={() => openInIde(ide)}>
										{ide.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						)}
						{apps.length > 0 && (
							<>
								{ides && <DropdownMenuSeparator />}
								<DropdownMenuGroup>
									<DropdownMenuLabel>Download for</DropdownMenuLabel>
									{apps.map((app) => (
										<DropdownMenuItem key={app} onClick={() => hintApp(app)}>
											{app}
										</DropdownMenuItem>
									))}
								</DropdownMenuGroup>
							</>
						)}
						{canShare && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={share}>Share to app…</DropdownMenuItem>
							</>
						)}
						{ides && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => openDirDialog()}>
									{dir ? `Download folder: ${dir}` : "Set download folder…"}
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}

			<Dialog open={askDir !== null} onOpenChange={(open: boolean) => !open && setAskDir(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Download folder</DialogTitle>
						<DialogDescription>
							Editors open files by local path, so MoodleFlow needs to know where your browser saves downloads.
						</DialogDescription>
					</DialogHeader>
					<form
						className="flex gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							if (!dirDraft.trim()) return;
							askDir?.(dirDraft.trim());
							setAskDir(null);
						}}
					>
						<Input autoFocus value={dirDraft} onChange={(e) => setDirDraft(e.target.value)} placeholder="/home/you/Downloads" aria-label="Download folder" />
						<Button type="submit">Save</Button>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
