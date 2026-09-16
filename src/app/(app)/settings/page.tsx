"use client";

import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
	const { theme, setTheme } = useTheme();
	const { connection, disconnect } = useMoodleConnection();

	return (
		<div className="flex max-w-xl flex-col gap-8">
			<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-medium">Appearance</h2>
				<Tabs value={theme} onValueChange={setTheme}>
					<TabsList>
						<TabsTrigger value="light">Light</TabsTrigger>
						<TabsTrigger value="dark">Dark</TabsTrigger>
						<TabsTrigger value="system">System</TabsTrigger>
					</TabsList>
				</Tabs>
			</section>

			<Separator />

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-medium">Moodle</h2>
				<div className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
					<div>
						<p className="font-medium">{connection?.siteName ?? "Not connected"}</p>
						<p className="text-xs text-muted-foreground">{connection?.siteUrl}</p>
					</div>
					<Badge variant="outline" className="border-success/30 bg-success/10 text-success">
						Connected
					</Badge>
				</div>
				<Button
					variant="outline"
					className="w-fit"
					onClick={() => {
						disconnect();
						toast.success("Disconnected from Moodle");
					}}
				>
					Disconnect
				</Button>
			</section>

			<Separator />

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-medium">Account</h2>
				<p className="text-sm text-muted-foreground">
					Signed in as {connection?.userFullName ?? "unknown"}. All data is stored only in this
					browser.
				</p>
			</section>
		</div>
	);
}
