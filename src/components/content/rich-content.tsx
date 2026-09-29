"use client";

import { useMemo } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { sanitizeMoodleHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

/**
 * Renders teacher-written Moodle HTML safely (see sanitizeMoodleHtml). Pluginfile URLs get the
 * user's token, but only for the Moodle host (client.fileUrl).
 */
export function RichContent({ html, className, pluginfileBase }: { html: string; className?: string; pluginfileBase?: string }) {
	const { client } = useMoodleConnection();

	const clean = useMemo(
		() =>
			sanitizeMoodleHtml(html, {
				pluginfileBase,
				fileUrl: client ? (url) => client.fileUrl(url, { download: false }) : undefined,
			}),
		[html, client, pluginfileBase],
	);

	return (
		<div
			className={cn(
				"text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_pre]:overflow-auto [&_table]:w-full [&_ul]:list-disc",
				className,
			)}
			dangerouslySetInnerHTML={{ __html: clean }}
		/>
	);
}
