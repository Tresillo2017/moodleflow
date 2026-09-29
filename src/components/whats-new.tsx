"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { releases } from "@/lib/releases";
import { toast } from "@/lib/toast";
import { notesToShow, PENDING_VERSION_KEY } from "@/lib/whats-new";

const MAX_ITEMS = 4;
const SHOW_FOR_MS = 20_000;
const SHOW_DELAY_MS = 600;

/** After the user reloads for an update, shows what changed in the version they landed on. */
export function WhatsNew() {
	const router = useRouter();

	useEffect(() => {
		let pending: string | null = null;
		try {
			pending = window.localStorage.getItem(PENDING_VERSION_KEY);
		} catch {
			return;
		}
		if (!pending) return;

		const running = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
		const release = notesToShow(pending, running, releases.find((r) => r.version === running) ?? null);

		// Deferred so the toaster has mounted, and so React's dev double-run cancels the first timer instead of losing the marker.
		const timer = setTimeout(() => {
			// cleared even with nothing to show, so a stale marker can't fire later
			try {
				window.localStorage.removeItem(PENDING_VERSION_KEY);
			} catch {}
			if (!release) return;

			const items = release.groups.flatMap((g) => g.items);
			toast.success(`Updated to v${release.version}`, {
				duration: SHOW_FOR_MS,
				description: (
					<ul className="list-disc space-y-1 pl-4 text-left">
						{items.slice(0, MAX_ITEMS).map((item) => (
							<li key={item}>{item}</li>
						))}
						{items.length > MAX_ITEMS && <li>and {items.length - MAX_ITEMS} more</li>}
					</ul>
				),
				button: { title: "Full changelog", onClick: () => router.push("/changelog") },
			});
		}, SHOW_DELAY_MS);
		return () => clearTimeout(timer);
	}, [router]);

	return null;
}
