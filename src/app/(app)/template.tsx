/** Templates remount on every navigation, so this gives each page a short enter transition. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
	return (
		<div className="animate-page-in">
			{children}
		</div>
	);
}
