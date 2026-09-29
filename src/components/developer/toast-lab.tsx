"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, Group } from "@/components/developer/panel";
import { showUpdateToast } from "@/components/update-prompt";
import { showWhatsNew } from "@/components/whats-new";
import { releases } from "@/lib/releases";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { SileoOptions, SileoPosition } from "sileo";

const POSITIONS: SileoPosition[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];
const TYPES = ["success", "error", "warning", "info", "action", "loading"] as const;
const LONG_TEXT =
	"A longer description that wraps over several lines, to check how the toast grows, whether text stays readable and the spring animation still settles cleanly.";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ToastLab() {
	const [title, setTitle] = useState("Something happened");
	const [description, setDescription] = useState("Optional description");
	const [position, setPosition] = useState<SileoPosition>("top-center");
	const [durationS, setDurationS] = useState("6");
	const [withButton, setWithButton] = useState(false);

	function options(): SileoOptions {
		const seconds = Number(durationS);
		return {
			position,
			description: description || undefined,
			duration: durationS === "" || seconds <= 0 ? null : seconds * 1000,
			button: withButton ? { title: "Undo", onClick: () => toast.success("Undone") } : undefined,
		};
	}

	const fire = (type: (typeof TYPES)[number]) => toast[type](title || "Untitled", options());

	return (
		<Panel title="Toasts" description="Fire every toast type with your own text, position and duration.">
			<div className="grid gap-3 sm:grid-cols-2">
				<label className="flex flex-col gap-1 text-xs text-muted-foreground">
					Title
					<Input value={title} onChange={(e) => setTitle(e.target.value)} />
				</label>
				<label className="flex flex-col gap-1 text-xs text-muted-foreground">
					Description
					<Input value={description} onChange={(e) => setDescription(e.target.value)} />
				</label>
				<label className="flex flex-col gap-1 text-xs text-muted-foreground">
					Duration (seconds, empty or 0 = stays until dismissed)
					<Input inputMode="numeric" value={durationS} onChange={(e) => setDurationS(e.target.value)} />
				</label>
				<label className="flex items-center gap-2 self-end pb-2 text-sm">
					<input type="checkbox" checked={withButton} onChange={(e) => setWithButton(e.target.checked)} />
					Add an action button
				</label>
			</div>

			<Group label="Position">
				{POSITIONS.map((p) => (
					<Button key={p} size="sm" variant={p === position ? "default" : "outline"} onClick={() => setPosition(p)}>
						{p}
					</Button>
				))}
			</Group>

			<Group label="Type">
				{TYPES.map((type) => (
					<Button key={type} size="sm" variant="outline" className={cn("capitalize")} onClick={() => fire(type)}>
						{type}
					</Button>
				))}
			</Group>

			<Group label="Scenarios">
				<Button
					size="sm"
					variant="outline"
					onClick={() =>
						toast.promise(wait(2000), {
							position,
							loading: { title: "Saving…" },
							success: { title: "Saved", description: "The promise resolved." },
							error: { title: "Failed" },
						})
					}
				>
					Promise resolves
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() =>
						toast
							.promise(wait(2000).then(() => Promise.reject(new Error("nope"))), {
								position,
								loading: { title: "Saving…" },
								success: { title: "Saved" },
								error: { title: "Couldn't save", description: "The promise rejected." },
							})
							.catch(() => {})
					}
				>
					Promise rejects
				</Button>
				<Button size="sm" variant="outline" onClick={() => toast.info("Long content", { position, description: LONG_TEXT, duration: 8000 })}>
					Long description
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						toast.success("First", { position });
						toast.error("Second", { position });
						toast.warning("Third", { position });
						toast.info("Fourth", { position });
					}}
				>
					Stack of four
				</Button>
				<Button size="sm" variant="outline" onClick={() => showUpdateToast(process.env.NEXT_PUBLIC_APP_VERSION)}>
					Update available
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => releases[0] && showWhatsNew(releases[0], () => (window.location.href = "/changelog"))}
				>
					What&apos;s new popout
				</Button>
				<Button size="sm" variant="ghost" onClick={() => toast.clear()}>
					Dismiss all
				</Button>
			</Group>
		</Panel>
	);
}
