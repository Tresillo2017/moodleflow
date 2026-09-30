"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMoodleConnection } from "@/components/providers/moodle-provider";

/** Link to the workshop's own page on the Moodle site, for what MoodleFlow can't do. */
export function OpenInMoodle({ cmid, label = "Open in Moodle" }: { cmid: number; label?: string }) {
	const { connection } = useMoodleConnection();
	if (!connection) return null;
	const href = new URL(`/mod/workshop/view.php?id=${cmid}`, connection.siteUrl).toString();
	return (
		<Button variant="outline" size="sm" nativeButton={false} render={<a href={href} target="_blank" rel="noopener noreferrer" />}>
			{label}
			<ExternalLink aria-hidden="true" />
		</Button>
	);
}
