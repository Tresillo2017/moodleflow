"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useRequireMoodleClient } from "@/components/providers/moodle-provider";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
	const client = useRequireMoodleClient();
	if (!client) return null;
	return <AppShell>{children}</AppShell>;
}
