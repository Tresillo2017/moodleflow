"use client";

import { useEffect, useRef } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { isXapiStatement } from "@/lib/moodle/normalize-embed";
import { isHttpUrl } from "@/lib/utils";
import type { H5pActivity } from "@/types/embed";

/**
 * Moodle's own H5P player in an iframe. Its origin is the Moodle site, not ours, so it can't reach the app;
 * we only keep same-origin off when the site happens to share our origin.
 */
export function H5pPlayer({ activity, onStatement }: { activity: H5pActivity; onStatement?: () => void }) {
	const { client } = useMoodleConnection();
	const frameRef = useRef<HTMLIFrameElement>(null);
	const player = useMoodleQuery(client ? () => client.getH5pPlayerUrl(activity) : null, [client, activity]);
	const src = isHttpUrl(player.data ?? undefined) ? player.data : null;

	// Embeds that relay xAPI (`{ context: "h5p", statement }`) get their statements recorded; Moodle's own embed page doesn't, so this is best effort.
	useEffect(() => {
		if (!client || !src || !activity.trackingEnabled) return;
		const origin = new URL(src).origin;
		const onMessage = (e: MessageEvent) => {
			const data = e.data as { context?: unknown; statement?: unknown } | null;
			if (e.origin !== origin || e.source !== frameRef.current?.contentWindow || data?.context !== "h5p" || !isXapiStatement(data.statement)) return;
			client.postXapiStatements([data.statement]).then(() => onStatement?.(), () => {});
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [client, src, activity.trackingEnabled, onStatement]);

	if (player.loading) return <ListSkeleton rows={2} />;
	if (player.error) return <ErrorState error={player.error} />;
	if (!src) return <EmptyState title="This content can't be shown here" description="Open it in Moodle to play it." />;

	const sameOrigin = new URL(src).origin === window.location.origin;
	return (
		<div className="flex flex-col gap-2">
			<iframe
				ref={frameRef}
				src={src}
				title={activity.name}
				sandbox={`allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox${sameOrigin ? "" : " allow-same-origin"}`}
				allow="fullscreen"
				allowFullScreen
				referrerPolicy="no-referrer"
				className="h-[70vh] min-h-96 w-full rounded-xl border bg-card"
			/>
			<p className="text-xs text-muted-foreground">Blank, or asking you to log in? Some Moodle sites don&apos;t allow their pages to be embedded. Use “Open in Moodle” above.</p>
		</div>
	);
}
