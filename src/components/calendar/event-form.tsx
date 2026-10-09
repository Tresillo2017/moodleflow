"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { toast } from "@/lib/toast";
import type { CalendarEventScope } from "@/types/calendar";

const SCOPE_LABELS: Record<CalendarEventScope, string> = {
	user: "Personal",
	course: "Course",
	site: "Site",
	group: "Group",
	category: "Category",
};

/** Scopes this form can fill in without more pickers (no group or category chooser yet). */
const SUPPORTED: CalendarEventScope[] = ["user", "course", "site"];

const today = () => {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function EventForm({ onCreated }: { onCreated: () => void }) {
	const { client } = useMoodleConnection();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [date, setDate] = useState(today);
	const [time, setTime] = useState("09:00");
	const [duration, setDuration] = useState(0);
	const [scope, setScope] = useState<CalendarEventScope>("user");
	const [courseId, setCourseId] = useState(0);

	const allowed = useMoodleQuery(client && open ? () => client.getAllowedEventTypes() : null, [client, open]).data;
	const courses = useMoodleQuery(client && open ? () => client.getCourses() : null, [client, open]).data ?? [];
	// an empty list means the site couldn't say; personal events are always allowed
	const scopes = SUPPORTED.filter((s) => s === "user" || !allowed?.length || allowed.includes(s));
	const needsCourse = scope === "course";

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!client || !name.trim() || busy || (needsCourse && !courseId)) return;
		const [y, m, d] = date.split("-").map(Number);
		const [h, min] = time.split(":").map(Number);
		setBusy(true);
		try {
			await client.createCalendarEvent({
				name: name.trim(),
				description: description.trim() ? `<p>${description.trim().replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p>` : undefined,
				start: new Date(y, m - 1, d, h, min).toISOString(),
				durationMinutes: duration || undefined,
				scope,
				courseId: needsCourse ? courseId : undefined,
			});
			setName("");
			setDescription("");
			setOpen(false);
			onCreated();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't create the event.");
		} finally {
			setBusy(false);
		}
	}

	const field = "h-9 rounded-lg border bg-card px-2 text-sm";

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm" />}>
				<Plus aria-hidden="true" />
				New event
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>New event</DialogTitle>
				</DialogHeader>
				<form onSubmit={submit} className="flex flex-col gap-3">
					<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" aria-label="Event name" required className={field} />
					<div className="flex gap-2">
						<input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" required className={`${field} flex-1`} />
						<input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" required className={field} />
					</div>
					<label className="flex items-center gap-2 text-sm">
						Duration (minutes)
						<input type="number" min={0} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={`${field} w-24`} />
					</label>
					<select value={scope} onChange={(e) => setScope(e.target.value as CalendarEventScope)} aria-label="Event type" className={field}>
						{scopes.map((s) => (
							<option key={s} value={s}>
								{SCOPE_LABELS[s]}
							</option>
						))}
					</select>
					{needsCourse && (
						<select value={courseId} onChange={(e) => setCourseId(Number(e.target.value))} aria-label="Course" required className={field}>
							<option value={0}>Choose a course…</option>
							{courses.map((c) => (
								<option key={c.id} value={c.id}>
									{c.shortName}
								</option>
							))}
						</select>
					)}
					<Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" aria-label="Description" rows={3} />
					<DialogFooter>
						<Button type="submit" disabled={busy || !name.trim() || (needsCourse && !courseId)}>
							{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
							Create
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
