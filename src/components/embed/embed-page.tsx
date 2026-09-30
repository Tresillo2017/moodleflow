"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RichContent } from "@/components/content/rich-content";
import { Button } from "@/components/ui/button";
import { isHttpUrl } from "@/lib/utils";

interface EmbedPageProps {
	courseId: number | null;
	title: string;
	intro?: string;
	/** The activity's page on the Moodle site, for what can't run here. */
	moodleUrl?: string;
	children?: React.ReactNode;
}

/** Shared frame of the H5P, SCORM and LTI pages: back link, title, description and an "Open in Moodle" escape hatch. */
export function EmbedPage({ courseId, title, intro, moodleUrl, children }: EmbedPageProps) {
	return (
		<div className="flex flex-col gap-6">
			<Link href={courseId ? `/courses/${courseId}` : "/courses"} className="group flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
				Back to course
			</Link>
			<PageHeader
				title={title}
				actions={
					isHttpUrl(moodleUrl) && (
						<Button variant="outline" size="sm" nativeButton={false} render={<a href={moodleUrl} target="_blank" rel="noopener noreferrer" />}>
							Open in Moodle
							<ExternalLink aria-hidden="true" />
						</Button>
					)
				}
			/>
			{intro && <RichContent html={intro} className="rounded-xl border bg-card p-4" />}
			{children}
		</div>
	);
}
