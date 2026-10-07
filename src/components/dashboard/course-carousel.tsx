"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CourseBanner } from "@/components/courses/course-banner";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { MoodleCourse } from "@/types/moodle";

/** Cover-flow of course tiles: the centred one is full size, the rest tilt away (distance is `--d`, in tiles). */
export function CourseCarousel({ courses, dueCounts }: { courses: MoodleCourse[]; dueCounts: Map<number, number> }) {
	const { prefs } = usePreferences();
	const track = useRef<HTMLUListElement>(null);
	const [active, setActive] = useState(0);

	const update = useCallback(() => {
		const el = track.current;
		if (!el) return;
		const middle = el.scrollLeft + el.clientWidth / 2;
		let nearest = 0;
		let nearestDistance = Infinity;
		el.querySelectorAll<HTMLElement>(":scope > li").forEach((item, index) => {
			const distance = (item.offsetLeft + item.offsetWidth / 2 - middle) / item.offsetWidth;
			item.style.setProperty("--d", distance.toFixed(3));
			if (Math.abs(distance) < nearestDistance) {
				nearestDistance = Math.abs(distance);
				nearest = index;
			}
		});
		setActive(nearest);
	}, []);

	useEffect(() => {
		const el = track.current;
		if (!el) return;
		let frame = 0;
		const onScroll = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(update);
		};
		update();
		el.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		return () => {
			cancelAnimationFrame(frame);
			el.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
		};
	}, [update, courses.length]);

	function centre(item: HTMLElement) {
		item.scrollIntoView({ behavior: prefs.motion === "reduced" ? "auto" : "smooth", inline: "center", block: "nearest" });
	}

	return (
		<ul ref={track} className="cf-track" aria-roledescription="carousel" aria-label="Your courses">
			{courses.map((course, index) => {
				const due = dueCounts.get(course.id) ?? 0;
				return (
					<li key={course.id} className="cf-item" aria-roledescription="slide" aria-label={`${index + 1} of ${courses.length}`}>
						<Link
							href={`/courses/${course.id}`}
							className="cf-card"
							onClick={(e) => {
								// a tile off to the side comes to the centre first; the centred one opens
								if (index === active) return;
								e.preventDefault();
								centre(e.currentTarget.parentElement as HTMLElement);
							}}
							onFocus={(e) => e.currentTarget.matches(":focus-visible") && centre(e.currentTarget.parentElement as HTMLElement)}
						>
							<CourseBanner course={course} className="cf-cover" />
							<div className="cf-info">
								<p className="cf-title">{course.fullName}</p>
								<p className="cf-sub">{course.shortName}</p>
								<p className="cf-meta tabular-nums">
									{due > 0 ? `${due} due` : course.progress !== undefined ? `${course.progress}% complete` : "Nothing due"}
								</p>
							</div>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
