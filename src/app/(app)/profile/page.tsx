"use client";

import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ProfilePage() {
	const { connection } = useMoodleConnection();
	const initials = (connection?.userFullName ?? "?")
		.split(" ")
		.map((p) => p[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();

	return (
		<div className="flex max-w-md flex-col items-center gap-3 pt-8 text-center">
			<Avatar className="size-16">
				<AvatarFallback className="text-lg">{initials}</AvatarFallback>
			</Avatar>
			<div>
				<h1 className="text-lg font-semibold">{connection?.userFullName}</h1>
				<p className="text-sm text-muted-foreground">{connection?.siteName}</p>
			</div>
		</div>
	);
}
