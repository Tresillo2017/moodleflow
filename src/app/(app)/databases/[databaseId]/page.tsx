"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { useDatabase } from "@/hooks/use-engage";
import { EngageFrame } from "@/components/engage/engage-frame";
import { DatabaseView } from "@/components/database/database-view";
import { FeatureGate, ListSkeleton } from "@/components/ui/state";

function DatabaseContent({ databaseId }: { databaseId: number }) {
	const courseId = Number(useSearchParams().get("course")) || null;
	const query = useDatabase(databaseId, courseId);
	return (
		<EngageFrame query={query} courseId={courseId} fallbackTitle="Database">
			{(database) => <DatabaseView database={database} />}
		</EngageFrame>
	);
}

export default function DatabasePage({ params }: { params: Promise<{ databaseId: string }> }) {
	const { databaseId } = use(params);
	return (
		<FeatureGate feature="Database" functions={["mod_data_get_databases_by_courses", "mod_data_get_fields", "mod_data_get_entries"]}>
			<Suspense fallback={<ListSkeleton rows={3} />}>
				<DatabaseContent databaseId={Number(databaseId)} />
			</Suspense>
		</FeatureGate>
	);
}
