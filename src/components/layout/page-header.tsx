interface PageHeaderProps {
	title: React.ReactNode;
	description?: React.ReactNode;
	/** Small line above the title, e.g. a course code or back link. */
	eyebrow?: React.ReactNode;
	actions?: React.ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
			<div className="flex min-w-0 flex-col gap-1">
				{eyebrow && <div className="text-xs font-medium text-muted-foreground">{eyebrow}</div>}
				<h1 className="text-4xl leading-tight font-normal italic text-balance">{title}</h1>
				{description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
			</div>
			{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
		</div>
	);
}
