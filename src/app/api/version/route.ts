// Read by open tabs (see UpdatePrompt) to learn whether a newer build has been deployed.
export const dynamic = "force-dynamic";

export function GET() {
	return Response.json(
		{ version: process.env.NEXT_PUBLIC_APP_VERSION, build: process.env.NEXT_PUBLIC_BUILD_ID },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
