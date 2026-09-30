"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { buildScoFrame } from "./scorm-package";
import { parseScormMessage, scormShimScript, SCORM_FLUSH } from "./scorm-api";
import type { ScormSco, ScormScoData, ScormTrack } from "@/types/embed";

type SaveState = "idle" | "saving" | "saved" | "error";
const FLUSH_WAIT_MS = 300;

interface ScormPlayerProps {
	files: Map<string, Uint8Array>;
	sco: ScormSco;
	attempt: number;
	/** Saved data for this SCO; must be a stable object (it is baked into the frame when it loads). */
	initial: ScormScoData;
	onExit: () => void;
}

/**
 * Runs one SCO in a sandboxed iframe (scripts only, opaque origin). The SCORM API lives inside the frame and reports
 * changes by postMessage; only messages from that frame are accepted, and only well-formed cmi.* tracks are saved.
 */
export function ScormPlayer({ files, sco, attempt, initial, onExit }: ScormPlayerProps) {
	const { client } = useMoodleConnection();
	const frameRef = useRef<HTMLIFrameElement>(null);
	const queue = useRef<Promise<void>>(Promise.resolve());
	const [url, setUrl] = useState<string | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const [saveState, setSaveState] = useState<SaveState>("idle");

	useEffect(() => {
		const frame = sco.launch ? buildScoFrame(files, sco.launch, scormShimScript(initial, window.location.origin)) : null;
		if (!frame) {
			setProblem("This part's start page isn't in the package. Open it in Moodle instead.");
			return;
		}
		setUrl(frame.url);
		return () => frame.dispose();
	}, [files, sco, initial]);

	// saves run one at a time so Moodle sees commits in order
	const save = useCallback(
		(tracks: ScormTrack[]) => {
			if (!client || !tracks.length) return;
			setSaveState("saving");
			queue.current = queue.current
				.then(() => client.saveScormTracks(sco.id, attempt, tracks))
				.then(
					() => setSaveState("saved"),
					() => {
						setSaveState("error");
						toast.error("Couldn't save your progress.");
					},
				);
		},
		[client, sco.id, attempt],
	);

	useEffect(() => {
		const onMessage = (e: MessageEvent) => {
			if (e.source !== frameRef.current?.contentWindow) return;
			const message = parseScormMessage(e.data);
			if (message) save(message.tracks);
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [save]);

	async function exit() {
		// ask the frame for anything uncommitted (the sandboxed origin is opaque, so "*" is the only possible target)
		frameRef.current?.contentWindow?.postMessage({ type: SCORM_FLUSH }, "*");
		await new Promise((resolve) => setTimeout(resolve, FLUSH_WAIT_MS));
		await queue.current;
		onExit();
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-3">
				<h2 className="min-w-0 flex-1 truncate text-lg">{sco.title}</h2>
				<span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
					{saveState === "saving" && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
					{saveState === "saved" && <Check className="size-3.5" aria-hidden="true" />}
					{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Progress saved" : saveState === "error" ? "Not saved" : `Attempt ${attempt}`}
				</span>
				<Button variant="outline" size="sm" onClick={exit}>
					Close
				</Button>
			</div>
			{problem ? (
				<p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{problem}</p>
			) : (
				url && (
					<iframe
						ref={frameRef}
						src={url}
						title={sco.title}
						sandbox="allow-scripts allow-forms allow-popups allow-modals"
						referrerPolicy="no-referrer"
						className="h-[75vh] min-h-96 w-full rounded-xl border bg-white"
					/>
				)
			)}
		</div>
	);
}
