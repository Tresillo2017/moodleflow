"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { createMoodleClient } from "@/lib/moodle/client";
import { fetchMoodleToken } from "@/lib/moodle/auth";
import { MoodleError } from "@/types/moodle";

function normalizeUrl(siteUrl: string): string {
	return siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
}

export function LoginForm({ className, ...props }: React.ComponentProps<"form">) {
	const [useToken, setUseToken] = useState(false);
	const [siteUrl, setSiteUrl] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [token, setToken] = useState("");
	const [useProxy, setUseProxy] = useState(false);
	const [status, setStatus] = useState<"idle" | "checking">("idle");
	const [error, setError] = useState<string | null>(null);
	const { connect } = useMoodleConnection();
	const router = useRouter();

	// after an expired session the provider sends people back here with their site filled in
	useEffect(() => {
		const site = new URLSearchParams(window.location.search).get("site");
		if (site) setSiteUrl(site);
	}, []);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		if (!siteUrl || (useToken ? !token : !username || !password)) {
			setError("Fill in all fields.");
			return;
		}

		setStatus("checking");
		try {
			const normalizedUrl = normalizeUrl(siteUrl);
			const resolvedToken = useToken ? token : await fetchMoodleToken(normalizedUrl, username, password, { proxy: useProxy });
			const client = createMoodleClient({ siteUrl: normalizedUrl, token: resolvedToken, proxy: useProxy });
			const info = await client.getSiteInfo();
			connect({
				siteUrl: normalizedUrl,
				token: resolvedToken,
				proxy: useProxy,
				siteName: info.siteName,
				userFullName: info.fullName,
			});
			toast.success(`Connected to ${info.siteName}`);
			router.replace("/dashboard");
		} catch (err) {
			const message =
				err instanceof MoodleError
					? err.message
					: "Couldn't connect. Check your details and that this site allows CORS requests from this app.";
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
		<form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
			<FieldGroup>
				<div className="flex flex-col items-center gap-1 text-center">
					<h1 className="text-4xl">Connect to Moodle</h1>
					<p className="text-sm text-balance text-muted-foreground">
						{useToken ? "Enter your site and web service token" : "Enter your Moodle site and login"}
					</p>
				</div>

				<Field>
					<FieldLabel htmlFor="siteUrl">Moodle site URL</FieldLabel>
					<Input
						id="siteUrl"
						placeholder="moodle.example.com"
						value={siteUrl}
						onChange={(e) => setSiteUrl(e.target.value)}
						autoComplete="url"
						required
					/>
				</Field>

				<label className="flex items-start gap-2 text-xs text-muted-foreground">
					<input type="checkbox" className="mt-0.5" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} />
					<span>
						My site blocks browser requests (CORS errors). Route traffic through MoodleFlow&apos;s proxy; it forwards requests to your
						Moodle and stores nothing.
					</span>
				</label>

				{useToken ? (
					<Field>
						<FieldLabel htmlFor="token">Web service token</FieldLabel>
						<Input
							id="token"
							type="password"
							placeholder="Your Moodle web service token"
							value={token}
							onChange={(e) => setToken(e.target.value)}
							autoComplete="off"
							required
						/>
					</Field>
				) : (
					<>
						<Field>
							<FieldLabel htmlFor="username">Username</FieldLabel>
							<Input
								id="username"
								placeholder="jane.doe"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								autoComplete="username"
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								autoComplete="current-password"
								required
							/>
						</Field>
					</>
				)}

				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<Field>
					<Button type="submit" disabled={status === "checking"}>
						{status === "checking" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
						Connect
					</Button>
					<Button type="button" variant="ghost" onClick={handleDemo}>
						Try the demo instead
					</Button>
				</Field>

				<FieldDescription className="text-center">
					<button type="button" className="underline underline-offset-4" onClick={() => setUseToken((v) => !v)}>
						{useToken ? "Use username and password instead" : "I have a web service token instead"}
					</button>
				</FieldDescription>
			</FieldGroup>
		</form>
	);
}
