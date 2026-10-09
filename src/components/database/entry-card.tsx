"use client";

import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { RichContent } from "@/components/content/rich-content";
import { EntryForm } from "@/components/database/entry-form";
import { FileList } from "@/components/files/file-list";
import { Button } from "@/components/ui/button";
import { MULTI_SEPARATOR } from "@/lib/moodle/database-form";
import { formatDistanceToNow } from "@/lib/format";
import { toast } from "@/lib/toast";
import { isHttpUrl } from "@/lib/utils";
import type { DatabaseAccess, DatabaseContent, DatabaseEntry, DatabaseField } from "@/types/database";

function Value({ field, c }: { field: DatabaseField; c: DatabaseContent }) {
	const { client } = useMoodleConnection();
	switch (field.type) {
		case "textarea":
			return <RichContent html={c.content} />;
		case "multimenu":
		case "checkbox":
			return <p className="text-sm">{c.content.split(MULTI_SEPARATOR).join(", ")}</p>;
		case "url":
			return isHttpUrl(c.content) ? (
				<a href={c.content} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
					{c.content1 || c.content}
				</a>
			) : (
				<p className="text-sm">{c.content}</p>
			);
		case "latlong":
			return (
				<a
					href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(c.content)}&mlon=${encodeURIComponent(c.content1 ?? "")}`}
					target="_blank"
					rel="noopener noreferrer"
					className="text-sm text-primary underline"
				>
					{c.content}, {c.content1}
				</a>
			);
		case "date":
			return <p className="text-sm">{Number(c.content) > 0 ? new Date(Number(c.content) * 1000).toLocaleDateString(undefined, { dateStyle: "medium" }) : ""}</p>;
		case "picture":
			return c.files[0] && client ? (
				// eslint-disable-next-line @next/next/no-img-element -- arbitrary Moodle hosts
				<img src={client.fileUrl(c.files[0].url, { download: false })} alt={c.content1 ?? ""} loading="lazy" className="max-h-64 w-fit max-w-full rounded-lg border" />
			) : null;
		case "file":
			return <FileList files={c.files} />;
		default:
			return <p className="text-sm whitespace-pre-wrap">{c.content}</p>;
	}
}

/** One database entry shown through its field definitions, with edit, delete and approve for those who may. */
export function EntryCard({ entry, fields, access, canUpdate, canRemove, onChanged }: { entry: DatabaseEntry; fields: DatabaseField[]; access: DatabaseAccess; canUpdate: boolean; canRemove: boolean; onChanged: () => void }) {
	const { client } = useMoodleConnection();
	const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");

	async function run(action: () => Promise<void>, done: string) {
		try {
			await action();
			toast.success(done);
			onChanged();
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "That didn't work. Try again.");
			setMode("view");
		}
	}

	if (mode === "edit") {
		return (
			<EntryForm
				fields={fields}
				entry={entry}
				submitLabel="Save entry"
				onCancel={() => setMode("view")}
				onSubmit={async (data) => {
					await client?.updateDatabaseEntry(entry.id, data);
					setMode("view");
					toast.success("Entry saved");
					onChanged();
				}}
			/>
		);
	}
	const shown = fields.filter((f) => entry.contents[f.id]?.content || entry.contents[f.id]?.files.length);
	return (
		<article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
			{shown.map((f) => (
				<div key={f.id} className="flex flex-col gap-0.5">
					<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{f.name}</p>
					<Value field={f} c={entry.contents[f.id]} />
				</div>
			))}
			<p className="text-xs text-muted-foreground">
				{entry.author}
				{(entry.modified ?? entry.created) && ` · ${formatDistanceToNow((entry.modified ?? entry.created)!)}`}
				{!entry.approved && " · awaiting approval"}
			</p>
			<footer className="flex flex-wrap items-center gap-1">
				{access.canApprove && (
					<Button variant="ghost" size="xs" onClick={() => void run(() => client!.approveDatabaseEntry(entry.id, !entry.approved), entry.approved ? "Approval removed" : "Entry approved")}>
						<Check aria-hidden="true" />
						{entry.approved ? "Unapprove" : "Approve"}
					</Button>
				)}
				{entry.canManage && canUpdate && (
					<Button variant="ghost" size="xs" onClick={() => setMode("edit")}>
						<Pencil aria-hidden="true" />
						Edit
					</Button>
				)}
				{entry.canManage && canRemove && mode === "view" && (
					<Button variant="ghost" size="xs" onClick={() => setMode("confirm-delete")}>
						<Trash2 aria-hidden="true" />
						Delete
					</Button>
				)}
				{mode === "confirm-delete" && (
					<>
						<Button variant="destructive" size="xs" onClick={() => void run(() => client!.deleteDatabaseEntry(entry.id), "Entry deleted")}>
							Delete entry
						</Button>
						<Button variant="ghost" size="xs" onClick={() => setMode("view")}>
							Keep
						</Button>
					</>
				)}
			</footer>
		</article>
	);
}
