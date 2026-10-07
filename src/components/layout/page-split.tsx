/** A page body split into a main column and a sidebar, bleeding to the panel's edges (see .sh-split). */
export function PageSplit({ aside, children }: { aside: React.ReactNode; children: React.ReactNode }) {
	return (
		<div className="sh-split">
			<div className="sh-split-main">{children}</div>
			<aside className="sh-split-aside">
				<div className="sh-aside-sticky flex flex-col gap-5">{aside}</div>
			</aside>
		</div>
	);
}
