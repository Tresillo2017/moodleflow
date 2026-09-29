import { MoodleError } from "@/types/moodle";
import { moodleUrl, type MoodleConnection } from "./call";
import { moodleExceptionToError } from "./errors";

export interface UploadOptions {
	/** Largest single file the site (or assignment) allows; 0/undefined = no limit. */
	maxBytes?: number;
	/** Overall progress across all files, 0..1. */
	onProgress?: (fraction: number) => void;
}

const RETRY_DELAY_MS = 800;
const NETWORK_MESSAGE =
	"Couldn't reach Moodle to upload the file. Check your connection, and that your site allows this origin in Allowed CORS origins.";

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

/** Throws before any bytes are sent when a file exceeds the size limit. */
export function checkUploadSize(files: { name: string; size: number }[], maxBytes?: number): void {
	if (!maxBytes) return;
	const tooBig = files.find((f) => f.size > maxBytes);
	if (tooBig) {
		throw new MoodleError("file_too_large", `${tooBig.name} is ${megabytes(tooBig.size)}; this site allows files up to ${megabytes(maxBytes)}.`);
	}
}

/** XHR rather than fetch: fetch can't report upload progress. */
function post(url: string, form: FormData, onProgress: (loaded: number) => void): Promise<{ status: number; body: unknown }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", url);
		xhr.upload.onprogress = (e) => onProgress(e.loaded);
		xhr.onerror = () => reject(new MoodleError("network_error", NETWORK_MESSAGE));
		xhr.onload = () => {
			let body: unknown = null;
			try {
				body = JSON.parse(xhr.responseText);
			} catch {}
			resolve({ status: xhr.status, body });
		};
		xhr.send(form);
	});
}

/** One retry: a flaky connection (e.g. ERR_NETWORK_CHANGED after switching Wi-Fi) often succeeds the second time. */
async function postWithRetry(url: string, form: FormData, onProgress: (loaded: number) => void) {
	try {
		return await post(url, form, onProgress);
	} catch {
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
		return post(url, form, onProgress);
	}
}

/**
 * Uploads files into a fresh Moodle draft area (webservice/upload.php) and returns its itemid,
 * ready to pass as a filemanager value to save_submission, forum posts, private files and friends.
 */
export async function uploadDraftFiles(connection: MoodleConnection, files: File[], options: UploadOptions = {}): Promise<number> {
	checkUploadSize(files, options.maxBytes);
	const total = files.reduce((n, f) => n + f.size, 0) || 1;
	let doneBytes = 0;
	let itemId = 0;
	for (const file of files) {
		const form = new FormData();
		form.set("token", connection.token);
		form.set("filearea", "draft");
		form.set("itemid", String(itemId));
		form.set("file_1", file, file.name);

		const { status, body } = await postWithRetry(moodleUrl(connection, "/webservice/upload.php").toString(), form, (loaded) =>
			options.onProgress?.(Math.min(1, (doneBytes + Math.min(loaded, file.size)) / total)),
		);
		const first = Array.isArray(body) ? (body[0] as { itemid?: unknown } | undefined) : undefined;
		if (status < 200 || status >= 300 || typeof first?.itemid !== "number") {
			const errorcode = body && typeof body === "object" && "errorcode" in body ? String((body as { errorcode: unknown }).errorcode) : undefined;
			const error = moodleExceptionToError(errorcode);
			throw errorcode ? error : new MoodleError("unknown_error", "Upload failed. Check the file's size and type.");
		}
		itemId = first.itemid;
		doneBytes += file.size;
		options.onProgress?.(doneBytes / total);
	}
	return itemId;
}
