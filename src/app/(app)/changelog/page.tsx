import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PageHeader } from "@/components/layout/page-header";
import { parseChangelog } from "@/lib/changelog";

export const metadata = { title: "What's new" };

// Read at build time: the page is static, so the Worker never touches the filesystem.
const releases = parseChangelog(readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8"));

export default function ChangelogPage() {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="What's new" description={`MoodleFlow v${process.env.NEXT_PUBLIC_APP_VERSION}`} />
			<div className="flex max-w-3xl flex-col gap-4">
				{releases.map((r) => (
					<section key={r.version} className="rounded-xl border bg-card p-4">
						<h2 className="flex items-baseline gap-2 text-xl">
							v{r.version}
							{r.date && <time className="font-sans text-xs font-normal text-muted-foreground not-italic">{r.date}</time>}
						</h2>
						{r.groups.map((g) => (
							<div key={g.title} className="mt-3">
								<h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.title}</h3>
								<ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
									{g.items.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</div>
						))}
					</section>
				))}
			</div>
		</div>
	);
}
