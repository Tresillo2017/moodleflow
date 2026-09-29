"use client";

import { Panel, Group } from "@/components/developer/panel";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton, NotEnabled } from "@/components/ui/state";
import { MoodleError } from "@/types/moodle";
import { useState } from "react";

const STATES = {
	loading: () => <ListSkeleton rows={3} />,
	empty: () => <EmptyState title="Nothing here yet" description="Empty state with a description." />,
	network: () => <ErrorState error={new MoodleError("network_error", "Couldn't reach the Moodle server.")} onRetry={() => {}} />,
	error: () => <ErrorState error={new MoodleError("unknown_error", "Moodle couldn't complete that request.")} onRetry={() => {}} />,
	denied: () => <ErrorState error={new MoodleError("access_denied", "Your Moodle account isn't allowed to do that.")} />,
	"not enabled": () => <NotEnabled feature="Example feature" />,
} as const;

/** Every shared page state, for checking themes and contrast without breaking a real page. */
export function UiStates() {
	const [shown, setShown] = useState<keyof typeof STATES>("loading");
	const Preview = STATES[shown];
	return (
		<Panel title="UI states" description="Loading, empty and error states as pages render them.">
			<Group label="State">
				{(Object.keys(STATES) as (keyof typeof STATES)[]).map((key) => (
					<Button key={key} size="sm" variant={key === shown ? "default" : "outline"} onClick={() => setShown(key)}>
						{key}
					</Button>
				))}
			</Group>
			<Preview />
		</Panel>
	);
}
