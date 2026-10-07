"use client";

import { useEffect, useRef, useState } from "react";
import { Accessibility, Bell, Filter, Leaf, PanelsTopLeft, Paintbrush, Settings } from "lucide-react";
import { PageSplit } from "@/components/layout/page-split";
import { AccessibilityTab, AdvancedTab, InterfaceTab, NotificationsTab } from "@/components/settings/basic-tabs";
import { GeneralTab } from "@/components/settings/general-tab";
import { SeasonalTab } from "@/components/settings/seasonal-tab";
import { SettingsSearchContext } from "@/components/settings/settings-ui";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { VisualTab } from "@/components/settings/visual-tab";
import { cn } from "@/lib/utils";

const TABS = [
	{ id: "general", label: "General", icon: Settings, panel: GeneralTab },
	{ id: "visual", label: "Visual", icon: Paintbrush, panel: VisualTab },
	{ id: "interface", label: "Interface", icon: PanelsTopLeft, panel: InterfaceTab },
	{ id: "notifications", label: "Notifications", icon: Bell, panel: NotificationsTab },
	{ id: "seasonal", label: "Seasonal", icon: Leaf, panel: SeasonalTab },
	{ id: "accessibility", label: "Accessibility", icon: Accessibility, panel: AccessibilityTab },
	{ id: "advanced", label: "Advanced", icon: Filter, panel: AdvancedTab },
] as const;

type TabId = (typeof TABS)[number]["id"];

const isTabId = (value: string): value is TabId => TABS.some((t) => t.id === value);

export default function SettingsPage() {
	const [tab, setTab] = useState<TabId>("general");
	const [query, setQuery] = useState("");
	const [noResults, setNoResults] = useState(false);
	const panels = useRef<HTMLDivElement>(null);
	const searching = query.trim() !== "";

	// The tab lives in the URL hash (#visual) so it survives a reload and can be linked to.
	useEffect(() => {
		const read = () => {
			const fromHash = window.location.hash.slice(1);
			if (isTabId(fromHash)) setTab(fromHash);
		};
		read();
		window.addEventListener("hashchange", read);
		return () => window.removeEventListener("hashchange", read);
	}, []);

	useEffect(() => {
		setNoResults(searching && !panels.current?.querySelector("[data-row]"));
	}, [query, searching]);

	function select(id: TabId) {
		setTab(id);
		window.history.replaceState(null, "", `#${id}`);
	}

	function onKeyDown(event: React.KeyboardEvent, index: number) {
		const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
		if (!step) return;
		event.preventDefault();
		const next = TABS[(index + step + TABS.length) % TABS.length];
		select(next.id);
		document.getElementById(`settings-tab-${next.id}`)?.focus();
	}

	return (
		<>
			<h1 className="sr-only">Settings</h1>
			<div className="sh-subtabs" role="tablist" aria-label="Settings sections">
				{TABS.map(({ id, label, icon: Icon }, index) => (
					<button
						key={id}
						id={`settings-tab-${id}`}
						type="button"
						role="tab"
						aria-selected={!searching && tab === id}
						aria-controls={`settings-panel-${id}`}
						tabIndex={tab === id ? 0 : -1}
						className={cn("sh-subtab", id === "advanced" && "sh-subtab-end")}
						onClick={() => {
							setQuery("");
							select(id);
						}}
						onKeyDown={(e) => onKeyDown(e, index)}
					>
						<Icon aria-hidden="true" />
						{label}
					</button>
				))}
			</div>
			<PageSplit aside={<SettingsSidebar query={query} onQueryChange={setQuery} />}>
				<SettingsSearchContext.Provider value={query}>
					<div ref={panels} className="flex flex-col gap-6">
						{TABS.map(({ id, panel: Panel }) =>
							searching || tab === id ? (
								<div key={id} id={`settings-panel-${id}`} role="tabpanel" aria-labelledby={`settings-tab-${id}`} className="animate-track-in">
									<Panel />
								</div>
							) : null,
						)}
						{noResults && <p className="py-10 text-center text-sm text-muted-foreground">No settings match &ldquo;{query.trim()}&rdquo;.</p>}
					</div>
				</SettingsSearchContext.Provider>
			</PageSplit>
		</>
	);
}
