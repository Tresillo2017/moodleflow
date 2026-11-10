"use client";

import { Dialog } from "radix-ui";
import React, { Suspense, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { IconInfoCircle, IconX } from "@tabler/icons-react";
import styles from "./notice.module.css";

const SEEN = "mf-notice-seen";

const noSubscription = () => () => {};
// ponytail: once per tab session, redirected visitors always see it
const shouldShow = () => new URLSearchParams(location.search).get("from") === "app" || !sessionStorage.getItem(SEEN);

interface NoticeProps {
	children: React.ReactNode
}

export function Notice({
	children
}: NoticeProps) {
	// server render and hydration see false; the client decides after hydration
	const wanted = useSyncExternalStore(noSubscription, shouldShow, () => false);
	const [closed, setClosed] = useState(false);
	const open = wanted && !closed;

	return (
		<Dialog.Root open={open} onOpenChange={(o) => {
			if (!o) {
				sessionStorage.setItem(SEEN, "1");
				setClosed(true);
			}
		}}>
			<Dialog.Portal>
				<Dialog.Overlay className={styles.overlay}>
					<Dialog.Content className={styles.notice} aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
						<Dialog.Close className={styles.close} aria-label="Close">
							<IconX size={18} />
						</Dialog.Close>
						<IconInfoCircle className={styles.icon} size={32} />
						<Dialog.Title className={styles.title}>The moodleflow web app has been discontinued</Dialog.Title>
						<p>
							moodleflow is now a userscript that runs right inside your Moodle site.
							The old web app and its links no longer open an app; install the script to get the same look back.
						</p>
						<Suspense fallback={null}>
							<RedirectedFrom />
						</Suspense>
						<div className={styles.actions}>
							{children}
						</div>
					</Dialog.Content>
				</Dialog.Overlay>
			</Dialog.Portal>
		</Dialog.Root>
	)
}

function RedirectedFrom() {
	const from = useSearchParams().get("from");

	if (from !== "app") return null;

	return <span className={styles.redirected}>Redirected from the old web app</span>
}
