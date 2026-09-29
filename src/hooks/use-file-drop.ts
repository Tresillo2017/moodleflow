"use client";

import { useEffect, useState } from "react";

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

/** Window-wide file drop: `dragging` is true while files hover the page; `onDrop` gets the dropped files. */
export function useFileDrop(enabled: boolean, onDrop: (files: File[]) => void): boolean {
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		if (!enabled) return;
		let depth = 0;
		const enter = (e: DragEvent) => {
			if (!hasFiles(e)) return;
			e.preventDefault();
			depth++;
			setDragging(true);
		};
		const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
		const leave = (e: DragEvent) => {
			if (!hasFiles(e)) return;
			depth = Math.max(0, depth - 1);
			if (depth === 0) setDragging(false);
		};
		const drop = (e: DragEvent) => {
			if (!hasFiles(e)) return;
			e.preventDefault();
			depth = 0;
			setDragging(false);
			const files = Array.from(e.dataTransfer?.files ?? []);
			if (files.length) onDrop(files);
		};
		window.addEventListener("dragenter", enter);
		window.addEventListener("dragover", over);
		window.addEventListener("dragleave", leave);
		window.addEventListener("drop", drop);
		return () => {
			window.removeEventListener("dragenter", enter);
			window.removeEventListener("dragover", over);
			window.removeEventListener("dragleave", leave);
			window.removeEventListener("drop", drop);
			setDragging(false);
		};
	}, [enabled, onDrop]);

	return dragging;
}
