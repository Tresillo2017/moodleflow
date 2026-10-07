"use client";

import Link from "next/link";
import { Activity, Bell, Calendar, Code, LayoutDashboard, LayoutPanelTop, Type } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useDeveloperMode } from "@/hooks/use-developer-mode";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DASHBOARD_SECTIONS, type DashboardSection } from "@/lib/preferences";
import { NotificationPreferencesRows } from "./notification-preferences";
import { Block, ChoiceRow, Group, Row, Section } from "./settings-ui";

export function InterfaceTab() {
	const { prefs, setPref } = usePreferences();
	return (
		<div className="flex flex-col gap-6">
			<Section id="layout" title="Layout" icon={LayoutPanelTop}>
				<Group>
					<ChoiceRow name="width" label="Content width" hint="Wide and Full use more of large screens." />
				</Group>
			</Section>
			<Section id="dashboard" title="Dashboard" icon={LayoutDashboard}>
				<Group>
					{(Object.keys(DASHBOARD_SECTIONS) as DashboardSection[]).map((key) => (
						<Row key={key} label={DASHBOARD_SECTIONS[key]} hint="Show on your dashboard">
							<Switch
								aria-label={DASHBOARD_SECTIONS[key]}
								checked={prefs.dashboard[key]}
								onCheckedChange={(checked) => setPref("dashboard", { ...prefs.dashboard, [key]: checked })}
							/>
						</Row>
					))}
				</Group>
			</Section>
			<Section id="datetime" title="Date & time" icon={Calendar}>
				<Group>
					<ChoiceRow name="weekStart" label="Week starts on" />
					<ChoiceRow name="clock" label="Clock" hint="Auto follows your browser's locale." />
				</Group>
			</Section>
		</div>
	);
}

export function NotificationsTab() {
	return (
		<Section id="notifications" title="Notifications" icon={Bell}>
			<Group>
				<Block keywords="notifications email push web mobile messages deadlines where moodle sends">
					<NotificationPreferencesRows />
				</Block>
			</Group>
		</Section>
	);
}

export function AccessibilityTab() {
	return (
		<div className="flex flex-col gap-6">
			<Section id="motion" title="Motion" icon={Activity}>
				<Group>
					<ChoiceRow name="motion" label="Motion" hint="Reduced turns off page and list animations." />
				</Group>
			</Section>
			<Section id="text" title="Text" icon={Type}>
				<Group>
					<ChoiceRow name="font" label="Font" preview />
					<ChoiceRow name="weight" label="Font weight" />
					<ChoiceRow name="scale" label="Text size" hint="Scales the whole interface." />
				</Group>
			</Section>
		</div>
	);
}

export function AdvancedTab() {
	const { enabled, setEnabled } = useDeveloperMode();
	return (
		<Section id="developer" title="Developer" icon={Code}>
			<Group>
				<Row label="Developer mode" hint="Test toasts, UI states and app internals. Tapping the version in General also turns it on.">
					<Switch aria-label="Developer mode" checked={enabled} onCheckedChange={setEnabled} />
				</Row>
				{enabled && (
					<Row label="Developer tools" hint="Open the diagnostics page.">
						<Button variant="outline" size="sm" nativeButton={false} render={<Link href="/settings/developer" />}>
							Open
						</Button>
					</Row>
				)}
			</Group>
		</Section>
	);
}
