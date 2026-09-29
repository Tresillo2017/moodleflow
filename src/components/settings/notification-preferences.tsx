"use client";

import { useEffect, useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useSupports } from "@/hooks/use-supports";
import { Switch } from "@/components/ui/switch";
import { ErrorState, ListSkeleton } from "@/components/ui/state";
import { toast } from "@/lib/toast";
import type { NotificationPreferences } from "@/types/moodle";

const note = "px-4 py-4 text-sm text-muted-foreground";

/** Per-type, per-channel notification toggles, written back as Moodle user preferences. */
export function NotificationPreferencesRows() {
	const { client, refresh } = useMoodleConnection();
	const supported = useSupports("core_message_get_user_notification_preferences", "core_user_update_user_preferences");
	const query = useMoodleQuery(client && supported ? () => client.getNotificationPreferences() : null, [client, supported]);
	const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
	useEffect(() => setPrefs(query.data), [query.data]);

	if (!supported) return <p className={note}>Your Moodle doesn&apos;t let apps change notification preferences. Change them in Moodle under Preferences.</p>;
	if (query.loading) return <div className="p-4"><ListSkeleton rows={3} /></div>;
	if (query.error) return <div className="p-4"><ErrorState error={query.error} onRetry={refresh} /></div>;
	if (!prefs || prefs.rows.length === 0) return <p className={note}>No notification types to configure.</p>;

	async function toggle(key: string, channel: string, enabled: boolean) {
		if (!client || !prefs) return;
		const before = prefs;
		const patch = (state: NotificationPreferences): NotificationPreferences => ({
			...state,
			rows: state.rows.map((r) => (r.key === key ? { ...r, channels: r.channels.map((c) => (c.name === channel ? { ...c, enabled } : c)) } : r)),
		});
		setPrefs(patch(before));
		try {
			await client.setNotificationPreference(before, key, channel, enabled);
		} catch {
			setPrefs(before);
			toast.error("Couldn't save that preference.");
		}
	}

	const components = [...new Set(prefs.rows.map((r) => r.component))];
	return (
		<>
			{components.map((component) => (
				<div key={component} className="flex flex-col">
					<p className="bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">{component}</p>
					{prefs.rows
						.filter((r) => r.component === component)
						.map((row) => (
							<div key={row.key} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
								<p className="min-w-40 flex-1 text-sm">{row.label}</p>
								<div className="flex gap-4">
									{row.channels.map((c) => (
										<label key={c.name} className="flex items-center gap-2 text-xs text-muted-foreground">
											<Switch size="sm" checked={c.enabled} disabled={c.locked} onCheckedChange={(v: boolean) => void toggle(row.key, c.name, v)} aria-label={`${row.label} via ${c.label}`} />
											{c.label}
										</label>
									))}
								</div>
							</div>
						))}
				</div>
			))}
		</>
	);
}
