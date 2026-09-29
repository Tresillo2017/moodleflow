import { MoodleError } from "@/types/moodle";
import type { MoodleConnection } from "./client";

/**
 * Uploads files into a fresh Moodle draft area (webservice/upload.php) and returns
 * its itemid, ready to pass as a filemanager value to save_submission and friends.
 * ponytail: fetch has no upload progress; switch to XHR if progress bars are needed.
 */
export async function uploadDraftFiles(connection: MoodleConnection, files: File[]): Promise<number> {
	let itemId = 0;
	for (const file of files) {
		const form = new FormData();
		form.set("token", connection.token);
		form.set("filearea", "draft");
		form.set("itemid", String(itemId));
		form.set("file_1", file, file.name);

		let response: Response;
		try {
			response = await fetch(new URL("/webservice/upload.php", connection.siteUrl), { method: "POST", body: form });
		} catch {
			throw new MoodleError("network_error", "Couldn't upload the file. Check your connection.");
		}
		const data: unknown = await response.json().catch(() => null);
		if (!response.ok || !Array.isArray(data) || !data[0] || typeof data[0].itemid !== "number") {
			const message = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "Upload failed.";
			throw new MoodleError("unknown_error", message);
		}
		itemId = data[0].itemid;
	}
	return itemId;
}
