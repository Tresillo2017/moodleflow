"use client";

import { useAssignments } from "@/hooks/use-assignments";
import Link from "next/link";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { usePreferences } from "@/components/providers/preferences-provider";
import { isCurrentCourse } from "@/lib/moodle/course-filter";
import { ACCENTS } from "@/lib/preferences";
import { isHttpUrl } from "@/lib/utils";
import { ExternalLink, Settings } from "lucide-react";

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col items-center gap-0.5 px-4 py-3">
			<span className="text-lg font-semibold tabular-nums">{value}</span>
			<span className="text-xs text-muted-foreground">{label}</span>
		</div>
	);
}

export default function ProfilePage() {
	const { client, connection } = useMoodleConnection();
	const { prefs } = usePreferences();
	const site = useMoodleQuery(client ? () => client.getSiteInfo() : null, [client]);
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]);
	const assignments = useAssignments();

	const name = connection?.userFullName ?? site.data?.fullName ?? "Student";
	const initials = name
		.split(" ")
		.map((p) => p[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
	const current = courses.data?.filter(isCurrentCourse);
	const graded = assignments.data?.filter((a) => a.status === "graded").length;
	const siteUrl = connection?.siteUrl ?? site.data?.siteUrl;

	return (
		<div className="mx-auto flex max-w-xl flex-col gap-6">
			<div className="overflow-hidden rounded-xl border bg-card">
				<div className="relative h-24">
					<DitherGradient from={ACCENTS[prefs.accent].ditherHue} direction="down" opacity={0.6} />
				</div>
				<div className="-mt-10 flex flex-col items-center gap-3 px-6 pb-6 text-center">
					<Avatar className="size-20 ring-4 ring-card">
						<AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">{initials}</AvatarFallback>
					</Avatar>
					<div>
						<h1 className="text-xl font-semibold tracking-tight">{name}</h1>
						<p className="text-sm text-muted-foreground">
							{site.data?.username ? `@${site.data.username} · ` : ""}
							{connection?.siteName ?? site.data?.siteName}
						</p>
					</div>
					<div className="flex flex-wrap justify-center gap-2">
						{isHttpUrl(siteUrl) && (
							<Button
								variant="outline"
								size="sm"
								nativeButton={false}
								render={<a href={`${siteUrl.replace(/\/$/, "")}/user/profile.php`} target="_blank" rel="noopener noreferrer" />}
							>
								Moodle profile
								<ExternalLink aria-hidden="true" />
							</Button>
						)}
						<Button variant="outline" size="sm" nativeButton={false} render={<Link href="/settings" />}>
							<Settings aria-hidden="true" />
							Settings
						</Button>
					</div>
				</div>
				<div className="grid grid-cols-3 divide-x border-t">
					<Stat label="Active courses" value={current ? String(current.length) : "—"} />
					<Stat label="Enrolled" value={courses.data ? String(courses.data.length) : "—"} />
					<Stat label="Graded work" value={graded !== undefined ? String(graded) : "—"} />
				</div>
			</div>
			{site.data?.release && (
				<p className="text-center text-xs text-muted-foreground">Moodle {site.data.release}</p>
			)}
		</div>
	);
}
