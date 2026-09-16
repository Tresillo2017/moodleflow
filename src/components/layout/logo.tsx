export function Logo({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 32 32"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="MoodleFlow"
		>
			<path
				d="M6 22c4-8 8-4 10-8s6-4 10 2"
				stroke="currentColor"
				strokeWidth="3.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx="6" cy="22" r="2.5" fill="currentColor" />
			<circle cx="26" cy="16" r="2.5" fill="currentColor" />
		</svg>
	);
}
