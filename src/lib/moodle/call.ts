import { MoodleError } from "@/types/moodle";
import { moodleExceptionToError } from "./errors";

export interface MoodleConnection {
	siteUrl: string;
	token: string;
	/** Route requests through this app's /api/moodle proxy (for sites without CORS headers). */
	proxy?: boolean;
}

export type MoodleParamValue = string | number | boolean | MoodleParams;
export type MoodleParams = { [key: string]: MoodleParamValue };

/** URL for a path on the Moodle site, or on the proxy when the connection uses it. */
export function moodleUrl(connection: Pick<MoodleConnection, "siteUrl" | "proxy">, path: string): URL {
	if (!connection.proxy) return new URL(path, connection.siteUrl);
	const origin = globalThis.location?.origin ?? "http://localhost";
	const url = new URL(`/api/moodle${path}`, origin);
	url.searchParams.set("moodle_site", new URL(connection.siteUrl).origin);
	return url;
}

/** Flattens nested params into Moodle's REST bracket notation, e.g. {a: {b: 1}} -> "a[b]=1". */
export function flattenParams(params: MoodleParams, prefix = ""): [string, string][] {
	const entries: [string, string][] = [];
	for (const [key, value] of Object.entries(params)) {
		const name = prefix ? `${prefix}[${key}]` : key;
		if (value && typeof value === "object") {
			entries.push(...flattenParams(value, name));
		} else {
			entries.push([name, String(value)]);
		}
	}
	return entries;
}

const RETRY_DELAYS_MS = [400, 1200];
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** GETs are idempotent, so a network failure or gateway error is retried; POSTs never are. */
async function fetchWithRetry(url: string, init: RequestInit, retry: boolean): Promise<Response> {
	for (let attempt = 0; ; attempt++) {
		const canRetry = retry && attempt < RETRY_DELAYS_MS.length;
		try {
			const response = await fetch(url, init);
			if (!canRetry || !RETRYABLE_STATUS.has(response.status)) return response;
		} catch {
			if (!canRetry) {
				throw new MoodleError(
					"network_error",
					"Couldn't reach the Moodle server. Check the site URL and your connection.",
				);
			}
		}
		await sleep(RETRY_DELAYS_MS[attempt]);
	}
}

export async function callMoodle<T>(
	connection: MoodleConnection,
	wsfunction: string,
	params: MoodleParams = {},
	method: "GET" | "POST" = "GET",
): Promise<T> {
	const url = moodleUrl(connection, "/webservice/rest/server.php");
	url.searchParams.set("wstoken", connection.token);
	url.searchParams.set("wsfunction", wsfunction);
	url.searchParams.set("moodlewsrestformat", "json");

	let response: Response;
	if (method === "GET") {
		for (const [key, value] of flattenParams(params)) url.searchParams.set(key, value);
		response = await fetchWithRetry(url.toString(), { method: "GET" }, true);
	} else {
		response = await fetchWithRetry(
			url.toString(),
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams(flattenParams(params)),
			},
			false,
		);
	}

	if (!response.ok) {
		throw new MoodleError("site_unavailable", `Moodle responded with status ${response.status}.`);
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new MoodleError("malformed_response", "Moodle returned a response that couldn't be parsed.");
	}

	if (data && typeof data === "object" && "exception" in data) {
		throw moodleExceptionToError((data as { errorcode?: string }).errorcode);
	}
	return data as T;
}

export const BATCH_FUNCTION = "tool_mobile_call_external_functions";
/** Calls per batch request; bigger lists are split. */
const BATCH_SIZE = 25;

export type CallResult = { data: unknown } | { error: MoodleError };
export interface BatchCall {
	wsfunction: string;
	params: MoodleParams;
}

function parseBatchResponse(r: { error?: boolean; data?: string; exception?: string }): CallResult {
	try {
		if (r.error) return { error: moodleExceptionToError((JSON.parse(r.exception ?? "{}") as { errorcode?: string }).errorcode) };
		return { data: JSON.parse(r.data ?? "null") };
	} catch {
		return { error: new MoodleError("malformed_response", "Moodle returned a response that couldn't be parsed.") };
	}
}

/** Runs many WS calls in one request via tool_mobile_call_external_functions. Results keep call order. */
export async function callMoodleBatch(connection: MoodleConnection, calls: BatchCall[]): Promise<CallResult[]> {
	const results: CallResult[] = [];
	for (let i = 0; i < calls.length; i += BATCH_SIZE) {
		const chunk = calls.slice(i, i + BATCH_SIZE);
		const requests = Object.fromEntries(
			chunk.map((c, index) => [index, { function: c.wsfunction, arguments: JSON.stringify(c.params) }]),
		);
		const raw = await callMoodle<{ responses?: { error?: boolean; data?: string; exception?: string }[] }>(
			connection,
			BATCH_FUNCTION,
			{ requests },
			"POST",
		);
		if (!Array.isArray(raw?.responses) || raw.responses.length !== chunk.length) {
			throw new MoodleError("malformed_response", "Moodle returned a response that couldn't be parsed.");
		}
		results.push(...raw.responses.map(parseBatchResponse));
	}
	return results;
}
