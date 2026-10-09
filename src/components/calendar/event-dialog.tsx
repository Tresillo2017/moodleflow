"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { RichContent } from "@/components/content/rich-content";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDayLabel, formatEventTime } from "@/lib/format";
import { modulePath } from "@/lib/moodle/links";
import { toast } from "@/lib/toast";
import type { MoodleCalendarEvent } from "@/types/moodle";

/** In-app page for the event's activity, else its course. */
export function eventPath(event: MoodleCalendarEvent): string | null {
	if (!event.courseId) return null;
	return event.module ? modulePath(event.module.name, event.module.instance, event.courseId) : `/courses/${event.courseId}`;
}

const toDateInput = (iso: string) => {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface EventDialogProps {
	event: MoodleCalendarEvent | null;
	hour12?: boolean;
	onClose: () => void;
	/** Called after the event was moved or deleted, so lists reload. */
	onChanged: () => void;
}

export function EventDialog({ event, hour12, onClose, onChanged }: EventDialogProps) {
	const { client } = useMoodleConnection();
	const [busy, setBusy] = useState(false);
	const path = event ? eventPath(event) : null;

	async function run(action: () => Promise<void>, failed: string) {
		setBusy(true);
		try {
			await action();
			onChanged();
			onClose();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : failed);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Dialog open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				{event && (
					<>
						<DialogHeader>
							<DialogTitle>{event.name}</DialogTitle>
							<DialogDescription>
								{formatDayLabel(event.startDate)} · {formatEventTime(event.startDate, hour12)}
								{event.endDate && ` – ${formatEventTime(event.endDate, hour12)}`}
								{event.courseName && ` · ${event.courseName}`}
							</DialogDescription>
						</DialogHeader>
						{event.description && <RichContent html={event.description} className="text-sm" />}
						{event.canEdit && (
							<label className="flex items-center gap-2 text-sm">
								<CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
								Move to
								<input
									type="date"
									defaultValue={toDateInput(event.startDate)}
									disabled={busy}
									aria-label="Move event to date"
									className="h-8 rounded-lg border bg-card px-2 text-sm"
									onChange={(e) => {
										if (!e.target.value || !client) return;
										const [y, m, d] = e.target.value.split("-").map(Number);
										void run(() => client.moveCalendarEvent(event.id, new Date(y, m - 1, d, 12).toISOString()), "Couldn't move the event.");
									}}
								/>
							</label>
						)}
						<DialogFooter>
							{event.canDelete && (
								<Button
									variant="outline"
									disabled={busy}
									onClick={() => client && void run(() => client.deleteCalendarEvent(event.id), "Couldn't delete the event.")}
								>
									{busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
									Delete
								</Button>
							)}
							{path && (
								<Button nativeButton={false} render={<Link href={path} />} onClick={onClose}>
									<ExternalLink aria-hidden="true" />
									Open
								</Button>
							)}
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
