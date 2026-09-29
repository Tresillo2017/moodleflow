"use client";

import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { courseHue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MoodleCourse } from "@/types/moodle";

/** Course image (token-authenticated) over a hue gradient that also serves as the fallback. */
export function CourseBanner({ course, className, children }: { course: MoodleCourse; className?: string; children?: React.ReactNode }) {
	const { client } = useMoodleConnection();
	const hue = courseHue(course.id);
	return (
		<div
			className={cn("relative overflow-hidden", className)}
			style={{ background: `linear-gradient(135deg, oklch(0.62 0.14 ${hue}), oklch(0.45 0.12 ${hue + 40}))` }}
		>
			{course.imageUrl && client && (
				// eslint-disable-next-line @next/next/no-img-element -- arbitrary Moodle hosts
				<img
					src={client.fileUrl(course.imageUrl, { download: false })}
					alt=""
					loading="lazy"
					onError={(e) => {
						e.currentTarget.hidden = true;
					}}
					className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
				/>
			)}
			{children}
		</div>
	);
}
