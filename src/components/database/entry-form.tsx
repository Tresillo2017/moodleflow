"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Textarea } from "@/components/ui/textarea";
import { buildSubmission, initialValues, isEditable, isFileField, missingFields, type DatabaseFormValues } from "@/lib/moodle/database-form";
import { toast } from "@/lib/toast";
import type { DatabaseEntry, DatabaseField, DatabaseSubmission } from "@/types/database";

const SELECT_CLASS = "h-9 rounded-lg border bg-card px-2 text-sm";

function Control({ field, values, set }: { field: DatabaseField; values: DatabaseFormValues; set: (key: string, value: string | string[] | File[]) => void }) {
	const k = `f${field.id}`;
	const text = (key: string) => (values[key] as string) ?? "";
	const label = field.name;
	switch (field.type) {
		case "textarea":
			return <RichTextEditor initialHtml={text(k)} onChange={(html) => set(k, html)} minRows={4} label={label} />;
		case "menu":
			return (
				<select aria-label={label} className={SELECT_CLASS} value={text(k)} onChange={(e) => set(k, e.target.value)}>
					<option value="">Choose…</option>
					{field.options.map((o) => (
						<option key={o}>{o}</option>
					))}
				</select>
			);
		case "radiobutton":
			return (
				<div role="radiogroup" aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1">
					{field.options.map((o) => (
						<label key={o} className="flex items-center gap-1.5 text-sm">
							<input type="radio" name={k} checked={text(k) === o} onChange={() => set(k, o)} />
							{o}
						</label>
					))}
				</div>
			);
		case "checkbox":
			return (
				<div role="group" aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1">
					{field.options.map((o) => {
						const picked = (values[k] as string[]) ?? [];
						return (
							<label key={o} className="flex items-center gap-1.5 text-sm">
								<input type="checkbox" checked={picked.includes(o)} onChange={(e) => set(k, e.target.checked ? [...picked, o] : picked.filter((p) => p !== o))} />
								{o}
							</label>
						);
					})}
				</div>
			);
		case "multimenu":
			return (
				<select
					aria-label={label}
					multiple
					className={`${SELECT_CLASS} h-auto py-1`}
					value={(values[k] as string[]) ?? []}
					onChange={(e) => set(k, Array.from(e.target.selectedOptions, (o) => o.value))}
				>
					{field.options.map((o) => (
						<option key={o}>{o}</option>
					))}
				</select>
			);
		case "url":
			return (
				<div className="flex flex-col gap-2 sm:flex-row">
					<Input type="url" aria-label={`${label} (address)`} placeholder="https://" value={text(k)} onChange={(e) => set(k, e.target.value)} />
					<Input aria-label={`${label} (text)`} placeholder="Link text (optional)" value={text(`${k}_1`)} onChange={(e) => set(`${k}_1`, e.target.value)} />
				</div>
			);
		case "latlong":
			return (
				<div className="flex gap-2">
					<Input type="number" step="any" min={-90} max={90} aria-label={`${label} (latitude)`} placeholder="Latitude" value={text(k)} onChange={(e) => set(k, e.target.value)} />
					<Input type="number" step="any" min={-180} max={180} aria-label={`${label} (longitude)`} placeholder="Longitude" value={text(`${k}_1`)} onChange={(e) => set(`${k}_1`, e.target.value)} />
				</div>
			);
		case "number":
			return <Input type="number" step="any" aria-label={label} value={text(k)} onChange={(e) => set(k, e.target.value)} />;
		case "date":
			return <Input type="date" aria-label={label} value={text(k)} onChange={(e) => set(k, e.target.value)} className="w-fit" />;
		case "picture":
		case "file":
			return (
				<div className="flex flex-col gap-2">
					<input type="file" aria-label={label} accept={field.type === "picture" ? "image/*" : undefined} onChange={(e) => set(k, Array.from(e.target.files ?? []).slice(0, 1))} className="text-sm" />
					{field.type === "picture" && <Input aria-label={`${label} (description)`} placeholder="Describe the picture" value={text(`${k}_1`)} onChange={(e) => set(`${k}_1`, e.target.value)} />}
				</div>
			);
		default:
			return field.type === "text" ? <Input aria-label={label} value={text(k)} onChange={(e) => set(k, e.target.value)} /> : <Textarea aria-label={label} value={text(k)} onChange={(e) => set(k, e.target.value)} />;
	}
}

/** A form built from the database's field definitions, for a new entry or an existing one. */
export function EntryForm({
	fields,
	entry,
	submitLabel,
	onSubmit,
	onCancel,
}: {
	fields: DatabaseField[];
	entry?: DatabaseEntry;
	submitLabel: string;
	onSubmit: (data: DatabaseSubmission[]) => Promise<void>;
	onCancel: () => void;
}) {
	const { client } = useMoodleConnection();
	const [values, setValues] = useState(() => initialValues(fields, entry));
	const [busy, setBusy] = useState(false);
	const editable = fields.filter(isEditable);
	const hasFile = (f: DatabaseField) => Boolean(entry?.contents[f.id]?.files.length);

	async function submit() {
		const missing = missingFields(editable, values, hasFile);
		if (missing.length > 0) return toast.error(`Fill in: ${missing.join(", ")}`);
		if (busy || !client) return;
		setBusy(true);
		try {
			const uploads: Record<number, number> = {};
			for (const f of editable.filter(isFileField)) {
				const files = values[`f${f.id}`] as File[];
				if (files.length > 0) uploads[f.id] = await client.uploadFiles(files);
			}
			await onSubmit(buildSubmission(editable, values, uploads));
		} catch (error) {
			toast.error(error instanceof Error && error.message ? error.message : "Couldn't save that entry.");
			setBusy(false);
		}
	}

	return (
		<form
			className="flex flex-col gap-4 rounded-xl border bg-card p-5"
			onSubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
		>
			{editable.map((f) => (
				<div key={f.id} className="flex flex-col gap-1.5">
					<p className="text-sm font-medium">
						{f.name}
						{f.required && <span className="text-destructive" aria-label="required"> *</span>}
					</p>
					{f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
					<Control field={f} values={values} set={(key, value) => setValues((v) => ({ ...v, [key]: value }))} />
					{entry && isFileField(f) && hasFile(f) && <p className="text-xs text-muted-foreground">Choosing a file replaces the current one.</p>}
				</div>
			))}
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
					Cancel
				</Button>
				<Button type="submit" disabled={busy}>
					{busy && <Loader2 className="animate-spin" aria-hidden="true" />}
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}
