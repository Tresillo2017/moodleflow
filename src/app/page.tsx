"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMoodleConnection } from "@/components/providers/moodle-provider";

export default function RootPage() {
	const { client, loading } = useMoodleConnection();
	const router = useRouter();

	useEffect(() => {
		if (loading) return;
		router.replace(client ? "/dashboard" : "/connect");
	}, [loading, client, router]);

	return null;
}
