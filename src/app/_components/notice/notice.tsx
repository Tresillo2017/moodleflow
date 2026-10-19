"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./notice.module.css";

interface NoticeProps {
	children: React.ReactNode
}

export function Notice({
	children
}: NoticeProps) {
	return (
		<aside className={styles.notice} role="note">
			<div className={styles.body}>
				<strong className={styles.title}>The moodleflow web app has been discontinued</strong>
				<p>
					moodleflow is now a userscript that runs on your Moodle site, so the old web app and its links and bookmarks no longer open an app.
					Install the script to get the same look back, right inside Moodle.
				</p>
				<Suspense fallback={null}>
					<RedirectedFrom />
				</Suspense>
			</div>
			<div className={styles.actions}>
				{children}
			</div>
		</aside>
	)
}

function RedirectedFrom() {
	const from = useSearchParams().get("from");

	if (from !== "app") return null;

	return (
		<p className={styles.redirected}>
			You were redirected from the old web app. Install moodleflow below to replace it.
		</p>
	)
}
