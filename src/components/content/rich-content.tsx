"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { cn } from "@/lib/utils";

/**
 * Renders teacher-written Moodle HTML safely: sanitised, links open in a new tab,
 * and pluginfile URLs get the user's token (only for the Moodle host, see client.fileUrl).
 */
export function RichContent({ html, className }: { html: string; className?: string }) {
	const { client } = useMoodleConnection();

	const clean = useMemo(() => {
		const purify = DOMPurify();
		purify.addHook("afterSanitizeAttributes", (node) => {
			if (node.tagName === "A") {
				node.setAttribute("target", "_blank");
				node.setAttribute("rel", "noopener noreferrer");
			}
			for (const attr of ["src", "href"]) {
				const value = node.getAttribute(attr);
				if (client && value?.includes("/pluginfile.php/")) {
					const withWebservice = value.replace(/(?<!\/webservice)\/pluginfile\.php\//, "/webservice/pluginfile.php/");
					node.setAttribute(attr, client.fileUrl(withWebservice, { download: false }));
				}
			}
		});
		return purify.sanitize(html);
	}, [html, client]);

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
