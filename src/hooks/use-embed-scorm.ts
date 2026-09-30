"use client";

import { useEffect, useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { readZip } from "@/components/embed/scorm-zip";
import type { ScormPackage } from "@/types/embed";

/** Packages bigger than this are left to Moodle's own player. */
const MAX_PACKAGE_BYTES = 150 * 1024 * 1024;

export interface ScormFilesState {
	files: Map<string, Uint8Array> | null;
	loading: boolean;
	error: string | null;
}

/** Downloads and unpacks a SCORM package once `enabled` (the learner asked to start), so browsing the page costs nothing. */
export function useScormFiles(pkg: ScormPackage | null, enabled: boolean): ScormFilesState {
	const { client } = useMoodleConnection();
	const [state, setState] = useState<ScormFilesState>({ files: null, loading: false, error: null });

	useEffect(() => {
		if (!enabled || !client || !pkg) return;
		let cancelled = false;
		setState({ files: null, loading: true, error: null });
		(async () => {
			if (pkg.demoFiles) return new Map(Object.entries(pkg.demoFiles).map(([name, text]) => [name, new TextEncoder().encode(text)]));
			if (!pkg.packageUrl) throw new Error("This package has no file to open.");
			const res = await fetch(client.fileUrl(pkg.packageUrl, { download: false }));
			if (!res.ok) throw new Error(`Couldn't download the package (${res.status}).`);
			if (Number(res.headers.get("content-length")) > MAX_PACKAGE_BYTES) throw new Error("This package is too large to open here.");
			return readZip(await res.arrayBuffer());
		})().then(
			(files) => !cancelled && setState({ files, loading: false, error: null }),
			(e: unknown) => !cancelled && setState({ files: null, loading: false, error: e instanceof Error && e.message ? e.message : "Couldn't open the package." }),
		);
		return () => {
			cancelled = true;
		};
	}, [client, pkg, enabled]);

	return state;
}
