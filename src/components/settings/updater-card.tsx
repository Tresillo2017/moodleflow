"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, Check, CircleAlert, Newspaper, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/relative-time";
import { applyUpdate, checkForUpdate, getUpdateState, useUpdateState, type UpdateStatus } from "@/lib/updater";
import { cn } from "@/lib/utils";
import { Block } from "./settings-ui";

const AUTO_CHECK_MS = 10 * 60 * 1000;
const TICK_MS = 30_000;

function useTick(ms: number) {
	const [, setTick] = useState(0);
	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), ms);
		return () => clearInterval(id);
	}, [ms]);
}

const TITLES: Record<UpdateStatus, string> = {
	idle: "You're up to date",
	current: "You're up to date",
	checking: "Checking for updates…",
	available: "Update available",
	updating: "Updating…",
	error: "Couldn't check for updates",
};

function Badge({ status }: { status: UpdateStatus }) {
	if (status === "current" || status === "idle") return <Check />;
	if (status === "available") return <ArrowDown />;
	if (status === "error") return <CircleAlert className="text-danger" />;
	return null;
}

/** bleh's "You're up to date" card: check for a newer deploy, see its version, and reload into it. */
export function UpdaterCard() {
	const update = useUpdateState();
	useTick(TICK_MS);

	useEffect(() => {
		const { checkedAt } = getUpdateState();
		if (!checkedAt || Date.now() - checkedAt > AUTO_CHECK_MS) void checkForUpdate();
	}, []);

	const running = process.env.NEXT_PUBLIC_APP_VERSION;
	const busy = update.status === "checking" || update.status === "updating";
	const incoming = update.status === "available" || update.status === "updating";
	const target = update.latest?.version || running;
	const checked = update.checkedAt ? `Last checked ${relativeTime(update.checkedAt)}` : "Not checked yet";
	const subtitle =
		update.status === "available"
			? `v${target} is ready. Reload to update.`
			: update.status === "updating"
				? `Reloading into v${target}`
				: update.status === "error"
					? `You may be offline. ${checked}`
					: checked;

	return (
		<Block keywords="update updater version check news changelog up to date">
			<div className="st-group flex flex-col divide-y">
				<div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
					<div className="st-updater-ring" aria-hidden="true">
						<RefreshCw className={cn(busy && "animate-spin")} strokeWidth={1.5} />
						<span className="st-updater-badge">
							<Badge status={update.status} />
						</span>
					</div>
					<div className="min-w-40 flex-1" aria-live="polite">
						<p className="text-sm font-medium">{TITLES[update.status]}</p>
						<p className="text-xs text-muted-foreground">{subtitle}</p>
					</div>
					<div className="flex items-center gap-2">
						{update.status === "available" ? (
							<Button size="sm" onClick={() => applyUpdate()}>
								<ArrowDown aria-hidden="true" />
								Update
							</Button>
						) : (
							<Button variant="secondary" size="sm" disabled={busy} onClick={() => void checkForUpdate()}>
								<RefreshCw aria-hidden="true" />
								Check
							</Button>
						)}
						<Button size="sm" nativeButton={false} render={<Link href="/changelog" />}>
							<Newspaper aria-hidden="true" />
							News
						</Button>
					</div>
				</div>
				{busy && <div className="st-updater-bar" role="progressbar" aria-label={TITLES[update.status]} />}
				<div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
					<span>{incoming ? "Updating to version" : "Latest version"}</span>
					<span className="text-muted-foreground tabular-nums">v{target}</span>
				</div>
			</div>
		</Block>
	);
}
