"use client";

import { useState } from "react";
import { Loader2, NotebookPen, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RichContent } from "@/components/content/rich-content";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, FeatureGate, ListSkeleton } from "@/components/ui/state";
import { Textarea } from "@/components/ui/textarea";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { formatDistanceToNow } from "@/lib/format";
import { toast } from "@/lib/toast";

const SITE = 0;

function NotesContent() {
	const { client, refresh } = useMoodleConnection();
	const courses = useMoodleQuery(client ? () => client.getCourses() : null, [client]).data ?? [];
	const [courseId, setCourseId] = useState(SITE);
	const [reloadKey, setReloadKey] = useState(0);
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const notes = useMoodleQuery(client ? () => client.getNotes(courseId) : null, [client, courseId, reloadKey]);

	async function run(action: () => Promise<void>, failed: string) {
		setBusy(true);
		try {
			await action();
			setReloadKey((k) => k + 1);
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : failed);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex max-w-2xl flex-col gap-6">
			<PageHeader title="Notes" description="Private notes to yourself, per course." />
			<select aria-label="Course" value={courseId} onChange={(e) => setCourseId(Number(e.target.value))} className="h-9 w-fit rounded-lg border bg-card px-2 text-sm">
				<option value={SITE}>Not tied to a course</option>
				{courses.map((c) => (
					<option key={c.id} value={c.id}>
						{c.shortName}
					</option>
				))}
			</select>

			<form
				className="flex flex-col gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					if (!client || !text.trim() || busy) return;
					void run(async () => {
						await client.addNote(courseId, text.trim());
						setText("");
					}, "Couldn't save the note.");
				}}
			>
				<Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a note…" aria-label="New note" rows={3} />
				<Button type="submit" size="sm" className="w-fit" disabled={busy || !text.trim()}>
					{busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
					Add note
				</Button>
			</form>

			{notes.loading && <ListSkeleton rows={2} />}
			{notes.error && <ErrorState error={notes.error} onRetry={refresh} />}
			{notes.data && notes.data.length === 0 && <EmptyState icon={NotebookPen} title="No notes yet" description="Notes you add here are only visible to you." />}
			{notes.data && notes.data.length > 0 && (
				<ul className="flex flex-col gap-3">
					{notes.data.map((n) => (
						<li key={n.id} className="flex flex-col gap-1 rounded-xl border bg-card p-4">
							{n.isHtml ? <RichContent html={n.text} /> : <p className="text-sm whitespace-pre-wrap">{n.text}</p>}
							<p className="flex items-center gap-1 text-xs text-muted-foreground">
								{(n.modified ?? n.created) && formatDistanceToNow((n.modified ?? n.created)!)}
								{n.state !== "personal" && ` · shared with ${n.state === "course" ? "the course" : "the site"}`}
								<button
									type="button"
									aria-label="Delete note"
									disabled={busy}
									onClick={() => void run(() => client!.deleteNote(n.id), "Couldn't delete the note.")}
									className="ml-auto hover:text-destructive focus-visible:outline-2"
								>
									<Trash2 className="size-3.5" aria-hidden="true" />
								</button>
							</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export default function NotesPage() {
	return (
		<FeatureGate feature="Notes" functions={["core_notes_get_course_notes", "core_notes_create_notes"]}>
			<NotesContent />
		</FeatureGate>
	);
}
