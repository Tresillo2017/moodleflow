import { MoodleError } from "@/types/moodle";
import type { MoodleConnection } from "./client";

/**
 * Uploads files into a fresh Moodle draft area (webservice/upload.php) and returns
 * its itemid, ready to pass as a filemanager value to save_submission and friends.
 * ponytail: fetch has no upload progress; switch to XHR if progress bars are needed.
 */
const RETRY_DELAY_MS = 800;

/** One retry: a flaky connection (e.g. ERR_NETWORK_CHANGED after switching Wi-Fi) often succeeds the second time. */
async function postWithRetry(url: URL, body: FormData): Promise<Response> {
	try {
		return await fetch(url, { method: "POST", body });
	} catch {
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
		try {
			return await fetch(url, { method: "POST", body });
		} catch {
			throw new MoodleError(
				"network_error",
				"Couldn't reach Moodle to upload the file. Check your connection, and that your site allows this origin in Allowed CORS origins.",
			);
		}
	}
}

export async function uploadDraftFiles(connection: MoodleConnection, files: File[]): Promise<number> {
	let itemId = 0;
	for (const file of files) {
		const form = new FormData();
		form.set("token", connection.token);
		form.set("filearea", "draft");
		form.set("itemid", String(itemId));
		form.set("file_1", file, file.name);

		const response = await postWithRetry(new URL("/webservice/upload.php", connection.siteUrl), form);
		const data: unknown = await response.json().catch(() => null);
		if (!response.ok || !Array.isArray(data) || !data[0] || typeof data[0].itemid !== "number") {
			const message = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "Upload failed.";
			throw new MoodleError("unknown_error", message);
		}
		itemId = data[0].itemid;
	}
	return itemId;
}
