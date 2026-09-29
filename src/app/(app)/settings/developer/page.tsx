"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Diagnostics } from "@/components/developer/diagnostics";
import { ToastLab } from "@/components/developer/toast-lab";
import { UiStates } from "@/components/developer/ui-states";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { useDeveloperMode } from "@/hooks/use-developer-mode";
import { toast } from "@/lib/toast";

export default function DeveloperPage() {
	const { enabled, ready, setEnabled } = useDeveloperMode();
	if (!ready) return null; // avoids flashing the "off" state before localStorage is read

	return (
		<div className="flex flex-col gap-8">
			<PageHeader
				eyebrow={
					<Link href="/settings" className="flex w-fit items-center gap-1 hover:text-foreground">
						<ArrowLeft className="size-3.5" aria-hidden="true" />
						Settings
					</Link>
				}
				title="Developer tools"
				description="Test toasts, UI states and app internals. Nothing here changes your Moodle data."
				actions={
					enabled && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setEnabled(false);
								toast.success("Developer mode turned off");
							}}
						>
							Turn off
						</Button>
					)
				}
			/>
			{enabled ? (
				<div className="flex max-w-3xl flex-col gap-10">
					<ToastLab />
					<UiStates />
					<Diagnostics />
				</div>
			) : (
				<EmptyState
					title="Developer mode is off"
					description="Tap the version number in Settings > About seven times to turn it on."
					action={
						<Button variant="outline" size="sm" nativeButton={false} render={<Link href="/settings#about" />}>
							Go to About
						</Button>
					}
				/>
			)}
		</div>
	);
}
