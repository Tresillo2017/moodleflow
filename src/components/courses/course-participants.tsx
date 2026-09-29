"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { formatDistanceToNow } from "@/lib/format";
import { isHttpUrl } from "@/lib/utils";

const selectClass = "h-8 rounded-lg border bg-background px-2 text-sm";
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function CourseParticipants({ courseId }: { courseId: number }) {
	const { client, refresh } = useMoodleConnection();
	const query = useMoodleQuery(client ? () => client.getParticipants(courseId) : null, [client, courseId]);
	const [search, setSearch] = useState("");
	const [role, setRole] = useState("");
	const [group, setGroup] = useState("");

	const people = query.data ?? [];
	const roles = useMemo(() => [...new Set(people.flatMap((p) => p.roles))].sort(), [people]);
	const groups = useMemo(() => [...new Map(people.flatMap((p) => p.groups).map((g) => [g.id, g.name])).entries()], [people]);
	const shown = people.filter(
		(p) =>
			p.fullName.toLowerCase().includes(search.trim().toLowerCase()) &&
			(!role || p.roles.includes(role)) &&
			(!group || p.groups.some((g) => String(g.id) === group)),
	);

	if (query.loading) return <ListSkeleton rows={4} />;
	if (query.error) return <ErrorState error={query.error} onRetry={refresh} />;
	if (people.length === 0) return <EmptyState icon={Users} title="No participants" description="Moodle didn't list anyone for this course." />;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap gap-2">
				<SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" aria-label="Search participants" className="min-w-48 flex-1" />
				{roles.length > 1 && (
					<select className={selectClass} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
						<option value="">All roles</option>
						{roles.map((r) => <option key={r}>{r}</option>)}
					</select>
				)}
				{groups.length > 0 && (
					<select className={selectClass} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by group">
						<option value="">All groups</option>
						{groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
					</select>
				)}
			</div>
			<p className="text-xs text-muted-foreground" aria-live="polite">{shown.length} of {people.length} participants</p>
			<ul className="divide-y overflow-hidden rounded-xl border bg-card">
				{shown.map((p) => (
					<li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
						<Avatar size="sm">
							{isHttpUrl(p.imageUrl) && <AvatarImage src={client?.fileUrl(p.imageUrl, { download: false })} alt="" />}
							<AvatarFallback>{initials(p.fullName)}</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium">{p.fullName}</p>
							<p className="truncate text-xs text-muted-foreground">{[...p.roles, ...p.groups.map((g) => g.name)].join(" · ")}</p>
						</div>
						<span className="text-xs text-muted-foreground">{p.lastAccess ? formatDistanceToNow(p.lastAccess) : "never"}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
