"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useScormFiles } from "@/hooks/use-embed-scorm";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { canPlayScorm, scormScoStatus } from "@/lib/moodle/normalize-embed";
import { toast } from "@/lib/toast";
import { ScormPlayer } from "./scorm-player";
import type { ScormPackage, ScormSco, ScormScoData } from "@/types/embed";

interface Session {
	sco: ScormSco;
	attempt: number;
	initial: ScormScoData;
}

/** Table of contents, attempt handling and the player for a SCORM 1.2 package; anything else is left to Moodle. */
export function ScormActivity({ pkg }: { pkg: ScormPackage }) {
	const { client } = useMoodleConnection();
	const playable = canPlayScorm(pkg);
	const [reloads, setReloads] = useState(0);
	const [session, setSession] = useState<Session | null>(null);
	const [starting, setStarting] = useState<number | null>(null);
	const [newAttempt, setNewAttempt] = useState(false);
	const scoes = useMoodleQuery(client && playable ? () => client.getScormScoes(pkg.id) : null, [client, pkg.id, playable]);
	const count = useMoodleQuery(client && playable ? () => client.getScormAttemptCount(pkg.id) : null, [client, pkg.id, playable, reloads]);
	const files = useScormFiles(pkg, session !== null || starting !== null);

	const attempts = count.data ?? 0;
	const attempt = newAttempt ? attempts + 1 : Math.max(attempts, 1);
	const canRestart = attempts > 0 && !newAttempt && (pkg.maxAttempts === 0 || attempts < pkg.maxAttempts);
	// saved data of the attempt being shown, for the per-part status
	const saved = useMoodleQuery(client && playable && attempts > 0 ? () => client.getScormUserData(pkg.id, attempts) : null, [client, pkg.id, playable, attempts, reloads]);

	async function start(sco: ScormSco) {
		if (!client) return;
		setStarting(sco.id);
		try {
			const data = await client.getScormUserData(pkg.id, attempt);
			void client.launchScorm(pkg.id, sco.id);
			setSession({ sco, attempt, initial: data[sco.id] ?? {} });
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't start this part.");
		} finally {
			setStarting(null);
		}
	}

	if (!playable) {
		return (
			<EmptyState
				title="This package can't run here"
				description="MoodleFlow plays SCORM 1.2 packages stored on your Moodle. This one is a different format or lives elsewhere. Open it in Moodle."
			/>
		);
	}
	if (scoes.loading || count.loading) return <ListSkeleton rows={3} />;
	if (scoes.error) return <ErrorState error={scoes.error} />;

	if (session) {
		const close = () => {
			setSession(null);
			setNewAttempt(false);
			setReloads((n) => n + 1);
		};
		if (files.error || (!files.loading && !files.files)) {
			return (
				<EmptyState
					title="Couldn't open this package"
					description={`${files.error ?? "Something went wrong."} Open it in Moodle instead.`}
					action={
						<Button variant="outline" size="sm" onClick={close}>
							Back
						</Button>
					}
				/>
			);
		}
		if (!files.files) return <ListSkeleton rows={2} />;
		return (
			<ScormPlayer
				key={session.sco.id}
				files={files.files}
				sco={session.sco}
				attempt={session.attempt}
				initial={session.initial}
				onExit={close}
			/>
		);
	}

	const launchable = (scoes.data ?? []).filter((s) => s.launch);
	return (
		<section className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-3">
				<p className="text-sm text-muted-foreground">
					{attempts === 0 ? "No attempts yet." : `Attempt ${attempt}${pkg.maxAttempts ? ` of ${pkg.maxAttempts}` : ""}`}
					{newAttempt && " (new)"}
				</p>
				{canRestart && (
					<Button variant="outline" size="sm" onClick={() => setNewAttempt(true)}>
						Start a new attempt
					</Button>
				)}
			</div>
			{launchable.length === 0 ? (
				<EmptyState title="Nothing to open" description="This package has no launchable parts." />
			) : (
				<ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
					{(scoes.data ?? []).map((sco) => {
						const status = newAttempt ? undefined : scormScoStatus(saved.data?.[sco.id]);
						return (
							<li key={sco.id} style={{ paddingLeft: `${1 + sco.depth * 1.25}rem` }} className="flex items-center gap-3 py-3 pr-4 text-sm">
								<span className={`min-w-0 flex-1 truncate ${sco.launch ? "font-medium" : "text-muted-foreground"}`}>{sco.title}</span>
								{status && <span className="text-xs text-muted-foreground capitalize">{status}</span>}
								{sco.launch && (
									<Button size="sm" variant={status ? "outline" : "default"} disabled={starting !== null} onClick={() => start(sco)}>
										{starting === sco.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
										{status === "incomplete" || status === "browsed" ? "Resume" : status ? "Review" : "Start"}
									</Button>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
