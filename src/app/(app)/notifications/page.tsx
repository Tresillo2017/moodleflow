"use client";

import { EmptyState } from "@/components/ui/state";
import { BellOff } from "lucide-react";

export default function NotificationsPage() {
	return (
		<div className="flex flex-col gap-6">
			<h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
			<EmptyState
				icon={BellOff}
				title="Notifications aren't wired up yet"
				description="This Moodle instance's messaging/notification web services vary by version — support lands in a follow-up."
			/>
		</div>
	);
}
