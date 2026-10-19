"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { IconInfoCircle } from "@tabler/icons-react";
import styles from "./notice.module.css";

interface NoticeProps {
	children: React.ReactNode
}

export function Notice({
	children
}: NoticeProps) {
	return (
		<aside className={styles.notice} role="note">
			<IconInfoCircle className={styles.icon} size={22} />
			<div className={styles.body}>
				<strong className={styles.title}>The moodleflow web app has been discontinued</strong>
				<p>
					moodleflow is now a userscript that runs right inside your Moodle site. Old app links no longer open an app.
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
			Redirected from the old web app
		</p>
	)
}
