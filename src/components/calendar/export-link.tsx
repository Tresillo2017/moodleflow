"use client";

import { useState } from "react";
import { Check, Copy, Rss } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMoodleQuery } from "@/hooks/use-moodle-query";

/** Subscribe URL for Google/Apple/Outlook calendars; the token inside grants read access, so it is fetched only on open. */
export function ExportLink() {
	const { client } = useMoodleConnection();
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const url = useMoodleQuery(client && open ? () => client.getCalendarExportUrl() : null, [client, open]);

	async function copy() {
		if (!url.data) return;
		await navigator.clipboard.writeText(url.data);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger render={<Button variant="outline" size="sm" />}>
				<Rss aria-hidden="true" />
				Subscribe
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80">
				<p className="text-sm font-medium">Subscribe from another calendar app</p>
				<p className="text-xs text-muted-foreground">Paste this address as a calendar subscription. Anyone with it can read your events, so keep it private.</p>
				{url.loading && <p className="text-xs text-muted-foreground">Loading…</p>}
				{url.error && <p className="text-xs text-danger">{url.error.message}</p>}
				{url.data === null && !url.loading && !url.error && <p className="text-xs text-muted-foreground">This site has no calendar export.</p>}
				{url.data && (
					<div className="flex items-center gap-2">
						<input readOnly value={url.data} aria-label="Calendar subscription address" onFocus={(e) => e.target.select()} className="h-8 min-w-0 flex-1 rounded-lg border bg-card px-2 text-xs" />
						<Button size="icon-sm" variant="outline" aria-label="Copy address" onClick={() => void copy()}>
							{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
