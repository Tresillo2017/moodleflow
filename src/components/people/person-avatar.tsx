"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { cn, isHttpUrl } from "@/lib/utils";

const initials = (name: string) =>
	name
		.split(/\s+/)
		.map((p) => p[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();

export function PersonAvatar({ name, imageUrl, size = "default", className }: { name: string; imageUrl?: string; size?: "default" | "sm" | "lg"; className?: string }) {
	const { client } = useMoodleConnection();
	return (
		<Avatar size={size} className={cn(className)}>
			{isHttpUrl(imageUrl) && <AvatarImage src={client?.fileUrl(imageUrl, { download: false })} alt="" />}
			<AvatarFallback>{initials(name) || "?"}</AvatarFallback>
		</Avatar>
	);
}
