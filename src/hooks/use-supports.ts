"use client";

import { useEffect, useState } from "react";
import { useMoodleConnection } from "@/components/providers/moodle-provider";

/** False once the site info has loaded and any of these web service functions isn't enabled on the site. */
export function useSupports(...functions: string[]): boolean {
	const { client } = useMoodleConnection();
	const [supported, setSupported] = useState(true);
	const key = functions.join(",");

	useEffect(() => {
		if (!client) return;
		let cancelled = false;
		client.getSiteInfo().then(
			() => !cancelled && setSupported(key.split(",").every((fn) => client.supports(fn))),
			() => {}, // the page's own queries report load errors
		);
		return () => {
			cancelled = true;
		};
	}, [client, key]);

	return supported;
}
