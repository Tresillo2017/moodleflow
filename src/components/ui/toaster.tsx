"use client";

import { useTheme } from "next-themes";
import { Toaster as Sileo } from "sileo";
import "sileo/styles.css";

/** Sileo's `theme` names the text tone, not the page: "light" text sits on our dark popover, and vice versa. */
export function Toaster() {
	const { resolvedTheme } = useTheme();
	return <Sileo position="top-center" theme={resolvedTheme === "light" ? "dark" : "light"} options={{ fill: "var(--toast-surface)" }} />;
}
