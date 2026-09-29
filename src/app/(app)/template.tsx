/** Templates remount on every navigation, so this gives each page a short enter transition. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
	return (
		<div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-300 ease-out">
			{children}
		</div>
	);
}
