export interface ChangelogRelease {
	version: string;
	date?: string;
	groups: { title: string; items: string[] }[];
}

/** Parses the Keep a Changelog markdown in CHANGELOG.md; releases with no entries (e.g. an empty Unreleased) are dropped. */
export function parseChangelog(markdown: string): ChangelogRelease[] {
	const releases: ChangelogRelease[] = [];
	let release: ChangelogRelease | undefined;
	let group: ChangelogRelease["groups"][number] | undefined;
	for (const line of markdown.split("\n")) {
		const heading = line.match(/^## \[([^\]]+)\](?: - (\S+))?/);
		if (heading) {
			release = { version: heading[1], date: heading[2], groups: [] };
			releases.push(release);
			group = undefined;
		} else if (release && line.startsWith("### ")) {
			group = { title: line.slice(4).trim(), items: [] };
			release.groups.push(group);
		} else if (group && line.startsWith("- ")) {
			group.items.push(line.slice(2).trim());
		}
	}
	return releases.filter((r) => r.groups.length > 0);
}
