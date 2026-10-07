"use client";

import { useRef } from "react";
import { ChevronRight, Download, RotateCcw, Upload } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { SearchInput } from "@/components/ui/search-input";
import { parseSettings, serializeSettings } from "@/lib/settings-file";
import { toast } from "@/lib/toast";

const REPO_URL = "https://github.com/Tresillo2017/moodleflow";
const MAX_IMPORT_BYTES = 1_000_000;

const item = "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none";

function buildTime(): string | null {
	const iso = process.env.NEXT_PUBLIC_BUILD_TIME;
	return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
}

/** Right column of Settings: search, Import / Export / Reset, and the build you're running. */
export function SettingsSidebar({ query, onQueryChange }: { query: string; onQueryChange: (query: string) => void }) {
	const { prefs, setPrefs, reset } = usePreferences();
	const fileInput = useRef<HTMLInputElement>(null);
	const build = process.env.NEXT_PUBLIC_BUILD_ID?.split("+")[1];
	const time = buildTime();

	function exportSettings() {
		const url = URL.createObjectURL(new Blob([serializeSettings(prefs, process.env.NEXT_PUBLIC_APP_VERSION)], { type: "application/json" }));
		const link = Object.assign(document.createElement("a"), { href: url, download: "moodleflow-settings.json" });
		link.click();
		URL.revokeObjectURL(url);
		toast.success("Settings exported");
	}

	async function importSettings(file: File | undefined) {
		if (!file) return;
		try {
			if (file.size > MAX_IMPORT_BYTES) throw new Error("That file is too large to be a settings export.");
			setPrefs(parseSettings(await file.text()));
			toast.success("Settings imported");
		} catch (error) {
			toast.error("Couldn't import settings", { description: error instanceof Error ? error.message : undefined });
		}
	}

	return (
		<>
			<SearchInput
				value={query}
				onChange={(e) => onQueryChange(e.target.value)}
				placeholder="Search for settings"
				aria-label="Search for settings"
				className="[&_input]:bg-background/40"
			/>
			<div className="text-sm text-muted-foreground">
				<p>Enjoying MoodleFlow?</p>
				<a
					href={REPO_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-0.5 text-(--sh-accent) hover:underline"
				>
					Star it on GitHub <ChevronRight className="size-3" aria-hidden="true" />
				</a>
			</div>
			<div className="st-group flex flex-col divide-y">
				<button type="button" className={item} onClick={() => fileInput.current?.click()}>
					<Download className="size-4 text-(--sh-accent-2)" aria-hidden="true" />
					Import
				</button>
				<button type="button" className={item} onClick={exportSettings}>
					<Upload className="size-4 text-(--sh-accent-2)" aria-hidden="true" />
					Export
				</button>
				<button
					type="button"
					className={item}
					onClick={() => {
						reset();
						toast.success("Settings reset");
					}}
				>
					<RotateCcw className="size-4 text-(--sh-accent-2)" aria-hidden="true" />
					Reset
				</button>
			</div>
			<input
				ref={fileInput}
				type="file"
				accept="application/json,.json"
				className="sr-only"
				tabIndex={-1}
				aria-hidden="true"
				onChange={(e) => {
					void importSettings(e.target.files?.[0]);
					e.target.value = "";
				}}
			/>
			<div className="flex flex-col gap-3 px-1 text-xs text-muted-foreground">
				<p>moodleflow {process.env.NEXT_PUBLIC_APP_VERSION}</p>
				{build && <p>build {build}</p>}
				{time && <p>{time}</p>}
			</div>
		</>
	);
}
