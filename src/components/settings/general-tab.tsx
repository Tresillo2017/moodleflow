"use client";

import { useRef } from "react";
import { ChevronRight, LogOut, Plug, RotateCw, User } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useDeveloperMode } from "@/hooks/use-developer-mode";
import { toast } from "@/lib/toast";
import { createTapCounter } from "@/lib/tap-unlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Block, Group, Row, Section } from "./settings-ui";
import { UpdaterCard } from "./updater-card";

const DEV_TAPS = 7;
const DEV_TAP_WINDOW_MS = 1500;
const REPO_URL = "https://github.com/Tresillo2017/moodleflow";

/** "Current version / moodleflow 0.13.0": the version doubles as the developer-mode switch (tap it seven times). */
function VersionHeader() {
	const { enabled, setEnabled } = useDeveloperMode();
	const counter = useRef(createTapCounter(DEV_TAPS, DEV_TAP_WINDOW_MS));
	const hint = useRef<string | null>(null);

	function tap() {
		const remaining = counter.current.tap();
		if (hint.current) toast.dismiss(hint.current);
		hint.current = null;
		if (enabled) {
			if (remaining === DEV_TAPS - 1) hint.current = toast.info("Developer mode is already on");
			return;
		}
		if (remaining === 0) {
			setEnabled(true);
			toast.success("Developer mode enabled", { description: "Developer tools are now in Settings > Advanced." });
		} else if (remaining <= 3) {
			hint.current = toast.info(`${remaining} more ${remaining === 1 ? "tap" : "taps"} to enable developer mode`, { duration: 1500 });
		}
	}

	return (
		<Block keywords="current version moodleflow">
			<p className="text-sm text-muted-foreground">Current version</p>
			<button type="button" onClick={tap} className="mt-0.5 flex items-baseline gap-2 text-left select-none">
				<span className="text-[2rem] leading-tight italic">moodleflow</span>
				<span className="text-[2rem] leading-tight text-(--sh-accent) not-italic">{process.env.NEXT_PUBLIC_APP_VERSION}</span>
			</button>
		</Block>
	);
}

function SupportLinks() {
	const link = "inline-flex items-center gap-0.5 text-(--sh-accent) hover:underline";
	return (
		<Block keywords="support issue report github help" className="text-sm text-muted-foreground">
			<p>Having issues updating or need support in general?</p>
			<p className="flex gap-4">
				<a className={link} href={`${REPO_URL}/issues/new`} target="_blank" rel="noopener noreferrer">
					Report issue <ChevronRight className="size-3" aria-hidden="true" />
				</a>
				<a className={link} href={REPO_URL} target="_blank" rel="noopener noreferrer">
					GitHub <ChevronRight className="size-3" aria-hidden="true" />
				</a>
			</p>
		</Block>
	);
}

function AccountSection() {
	const { connection, refresh } = useMoodleConnection();
	return (
		<Section id="account" title="Account" icon={User}>
			<Group>
				<Block keywords="account moodle site connected user" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
					<div className="min-w-0">
						<p className="truncate text-sm font-medium">{connection?.siteName ?? "Moodle site"}</p>
						<p className="truncate text-xs text-muted-foreground">
							{connection?.userFullName ? `${connection.userFullName} · ` : ""}
							{connection?.siteUrl}
						</p>
					</div>
					<Badge variant="outline" className="border-success/30 bg-success/10 text-success">
						{connection?.mock ? "Demo mode" : "Connected"}
					</Badge>
				</Block>
				<Row label="Refresh data" hint="Reload courses, grades and events from Moodle.">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							refresh();
							toast.success("Refreshing data from Moodle");
						}}
					>
						<RotateCw aria-hidden="true" />
						Refresh
					</Button>
				</Row>
			</Group>
		</Section>
	);
}

function ConnectionSection() {
	const { connection, disconnect } = useMoodleConnection();
	return (
		<Section id="connection" title="Connection" icon={Plug}>
			<Group>
				{!connection?.mock && connection && (
					<Row label="Manage tokens" hint="Moodle can't revoke a token from here. Delete the mobile app key in Moodle's Security keys to invalidate it everywhere.">
						<Button variant="outline" size="sm" nativeButton={false} render={<a href={new URL("/user/managetoken.php", connection.siteUrl).toString()} target="_blank" rel="noopener noreferrer" />}>
							Open in Moodle
						</Button>
					</Row>
				)}
				<Row label="Sign out" hint="Removes the saved token from this browser.">
					<Button
						variant="destructive"
						size="sm"
						onClick={() => {
							disconnect();
							toast.success("Disconnected from Moodle");
						}}
					>
						<LogOut aria-hidden="true" />
						Sign out
					</Button>
				</Row>
			</Group>
		</Section>
	);
}

export function GeneralTab() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-4">
				<VersionHeader />
				<UpdaterCard />
				<SupportLinks />
			</div>
			<AccountSection />
			<ConnectionSection />
		</div>
	);
}
