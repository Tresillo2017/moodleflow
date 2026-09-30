"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { ltiFormHtml } from "@/lib/moodle/normalize-embed";
import { toast } from "@/lib/toast";
import type { LtiTool } from "@/types/embed";

const REVOKE_AFTER_MS = 60_000;

/** Fetches a fresh signed launch (they expire fast) and posts it to the tool in a new tab that can't reach this app. */
export function LtiLaunchButton({ tool }: { tool: LtiTool }) {
	const { client } = useMoodleConnection();
	const [launching, setLaunching] = useState(false);

	async function launch() {
		if (!client) return;
		setLaunching(true);
		try {
			const page = URL.createObjectURL(new Blob([ltiFormHtml(await client.getLtiLaunch(tool.id))], { type: "text/html" }));
			window.open(page, "_blank", "noopener,noreferrer");
			setTimeout(() => URL.revokeObjectURL(page), REVOKE_AFTER_MS);
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't open the tool.");
		} finally {
			setLaunching(false);
		}
	}

	return (
		<Button className="w-fit" onClick={launch} disabled={launching}>
			{launching ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}
			Launch tool
		</Button>
	);
}
