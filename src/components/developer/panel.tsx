export function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-3">
			<div>
				<h2 className="text-2xl">{title}</h2>
				{description && <p className="text-sm text-muted-foreground">{description}</p>}
			</div>
			<div className="flex flex-col gap-4 rounded-xl glass p-4 shadow-[var(--ring-inset)]">{children}</div>
		</section>
	);
}

export function Group({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-2">
			<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
			<div className="flex flex-wrap items-center gap-2">{children}</div>
		</div>
	);
}
