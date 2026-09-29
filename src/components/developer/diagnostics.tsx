"use client";

import { Panel, Group } from "@/components/developer/panel";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { idbStore } from "@/lib/idb-store";
import { PENDING_VERSION_KEY } from "@/lib/whats-new";
import { toast } from "@/lib/toast";

export function Diagnostics() {
	const { client, connection, refresh } = useMoodleConnection();
	const info = useMoodleQuery(client ? () => client.getSiteInfo() : null, [client]);
	const rows: [string, string][] = [
		["App version", process.env.NEXT_PUBLIC_APP_VERSION ?? "?"],
		["Build", process.env.NEXT_PUBLIC_BUILD_ID ?? "?"],
		["Site", connection?.siteUrl ?? "not connected"],
		["Mode", connection?.mock ? "demo" : connection?.proxy ? "live via CORS proxy" : "live"],
		["Moodle release", info.data?.release || "?"],
		["Enabled functions", info.data ? String(info.data.functions.length) : "?"],
		["Max upload", info.data?.maxUploadBytes ? `${Math.round(info.data.maxUploadBytes / 1024 / 1024)} MB` : "no site limit"],
	];

	return (
		<Panel title="Diagnostics" description="What this build and connection look like.">
			<dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
				{rows.map(([label, value]) => (
					<div key={label} className="contents">
						<dt className="text-muted-foreground">{label}</dt>
						<dd className="font-mono text-xs break-all">{value}</dd>
					</div>
				))}
			</dl>
			<Group label="Actions">
				<Button
					size="sm"
					variant="outline"
					onClick={async () => {
						await idbStore.clear().catch(() => {});
						refresh();
						toast.success("Cache cleared", { description: "Data will reload from Moodle." });
					}}
				>
					Clear data cache
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						window.localStorage.setItem(PENDING_VERSION_KEY, process.env.NEXT_PUBLIC_APP_VERSION ?? "");
						toast.info("Marker set", { description: "Reload the page to see the what's-new popout." });
					}}
				>
					Queue what&apos;s-new popout
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						window.location.reload();
					}}
				>
					Reload app
				</Button>
			</Group>
		</Panel>
	);
}
