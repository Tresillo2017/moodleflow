"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/layout/logo";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { createMoodleClient } from "@/lib/moodle/client";
import { MoodleError } from "@/types/moodle";

export default function ConnectPage() {
	const [siteUrl, setSiteUrl] = useState("");
	const [token, setToken] = useState("");
	const [status, setStatus] = useState<"idle" | "checking">("idle");
	const [error, setError] = useState<string | null>(null);
	const { connect } = useMoodleConnection();
	const router = useRouter();

	async function handleConnect(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		if (!siteUrl || !token) {
			setError("Enter both your Moodle site URL and a web service token.");
			return;
		}

		setStatus("checking");
		try {
			const normalizedUrl = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
			const client = createMoodleClient({ siteUrl: normalizedUrl, token });
			const info = await client.getSiteInfo();
			connect({
				siteUrl: normalizedUrl,
				token,
				siteName: info.siteName,
				userFullName: info.fullName,
			});
			toast.success(`Connected to ${info.siteName}`);
			router.replace("/dashboard");
		} catch (err) {
			const message =
				err instanceof MoodleError
					? err.message
					: "Couldn't connect. Check the URL and token, and that this site allows CORS requests from this app.";
			setError(message);
		} finally {
			setStatus("idle");
		}
	}

	function handleDemo() {
		connect({ siteUrl: "https://demo.moodleflow.dev", token: "mock", mock: true, siteName: "Demo University", userFullName: "Tomas" });
		toast.success("Connected to demo mode");
		router.replace("/dashboard");
	}

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<div className="w-full max-w-sm">
				<div className="mb-8 flex flex-col items-center text-center">
					<Logo className="mb-4 size-8 text-primary" />
					<h1 className="text-xl font-semibold tracking-tight">MoodleFlow</h1>
					<p className="mt-1 text-sm text-muted-foreground">A modern interface for Moodle.</p>
				</div>

				<form onSubmit={handleConnect} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="siteUrl">Moodle site URL</Label>
						<Input
							id="siteUrl"
							placeholder="moodle.example.com"
							value={siteUrl}
							onChange={(e) => setSiteUrl(e.target.value)}
							autoComplete="url"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="token">Web service token</Label>
						<Input
							id="token"
							type="password"
							placeholder="Your Moodle web service token"
							value={token}
							onChange={(e) => setToken(e.target.value)}
							autoComplete="off"
						/>
					</div>

					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<Button type="submit" disabled={status === "checking"}>
						{status === "checking" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
						Connect
					</Button>
					<Button type="button" variant="ghost" onClick={handleDemo}>
						Try the demo instead
					</Button>
				</form>

				<p className="mt-6 text-center text-xs text-muted-foreground">
					Your token stays in this browser. MoodleFlow talks directly to your Moodle site — nothing
					passes through any MoodleFlow server.
				</p>
			</div>
		</div>
	);
}
