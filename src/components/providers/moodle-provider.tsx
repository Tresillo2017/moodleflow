"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createMoodleClient, type MoodleClient } from "@/lib/moodle/client";
import { createMockMoodleClient } from "@/lib/moodle/mock";
import {
	clearConnection,
	loadConnection,
	saveConnection,
	type StoredConnection,
} from "@/lib/moodle/connection";

interface MoodleContextValue {
	connection: StoredConnection | null;
	client: MoodleClient | null;
	loading: boolean;
	connect: (connection: StoredConnection) => void;
	disconnect: () => void;
}

const MoodleContext = createContext<MoodleContextValue | null>(null);

export function MoodleProvider({ children }: { children: React.ReactNode }) {
	const [connection, setConnection] = useState<StoredConnection | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setConnection(loadConnection());
		setLoading(false);
	}, []);

	const client = useMemo<MoodleClient | null>(() => {
		if (!connection) return null;
		if (connection.mock) return createMockMoodleClient();
		return createMoodleClient(connection);
	}, [connection]);

	const value: MoodleContextValue = {
		connection,
		client,
		loading,
		connect: (next) => {
			saveConnection(next);
			setConnection(next);
		},
		disconnect: () => {
			clearConnection();
			setConnection(null);
		},
	};

	return <MoodleContext.Provider value={value}>{children}</MoodleContext.Provider>;
}

export function useMoodleConnection(): MoodleContextValue {
	const ctx = useContext(MoodleContext);
	if (!ctx) throw new Error("useMoodleConnection must be used within MoodleProvider");
	return ctx;
}

/** Redirects to /connect when no client is available; use in (app) pages. */
export function useRequireMoodleClient(): MoodleClient | null {
	const { client, loading } = useMoodleConnection();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !client) router.replace("/connect");
	}, [loading, client, router]);

	return client;
}
