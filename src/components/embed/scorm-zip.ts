/** Minimal zip reader for SCORM packages (stored + deflate, no zip64/encryption), using the browser's DecompressionStream. */

export const MAX_ENTRIES = 5000;
/** Total unpacked size we're willing to hold in memory. */
export const MAX_UNPACKED_BYTES = 200 * 1024 * 1024;

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const EOCD_MAX_DISTANCE = 22 + 0xffff;

export class ZipError extends Error {}

async function inflate(compressed: Uint8Array<ArrayBuffer>, expected: number): Promise<Uint8Array> {
	const reader = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
	const out = new Uint8Array(expected);
	let length = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		// the declared size is attacker-controlled: never write past it
		if (length + value.length > expected) {
			await reader.cancel();
			throw new ZipError("A file in the package is larger than it claims to be.");
		}
		out.set(value, length);
		length += value.length;
	}
	if (length !== expected) throw new ZipError("A file in the package is corrupt.");
	return out;
}

/** Package path for a zip entry name: forward slashes, no leading slash. */
export const entryPath = (name: string) => name.replace(/\\/g, "/").replace(/^\/+/, "");

export async function readZip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
	const bytes = new Uint8Array(buffer);
	const view = new DataView(buffer);
	let eocd = -1;
	for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - EOCD_MAX_DISTANCE); i--) {
		if (view.getUint32(i, true) === EOCD) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new ZipError("This isn't a valid zip package.");

	const entries = view.getUint16(eocd + 10, true);
	let cursor = view.getUint32(eocd + 16, true);
	if (entries === 0xffff || cursor === 0xffffffff) throw new ZipError("Zip64 packages aren't supported.");
	if (entries > MAX_ENTRIES) throw new ZipError("This package has too many files.");

	const decoder = new TextDecoder();
	const files = new Map<string, Uint8Array>();
	let unpacked = 0;
	for (let n = 0; n < entries; n++) {
		if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== CENTRAL) throw new ZipError("This isn't a valid zip package.");
		const flags = view.getUint16(cursor + 8, true);
		const method = view.getUint16(cursor + 10, true);
		const compressed = view.getUint32(cursor + 20, true);
		const size = view.getUint32(cursor + 24, true);
		const nameLength = view.getUint16(cursor + 28, true);
		const extraLength = view.getUint16(cursor + 30, true);
		const commentLength = view.getUint16(cursor + 32, true);
		const local = view.getUint32(cursor + 42, true);
		const name = entryPath(decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)));
		cursor += 46 + nameLength + extraLength + commentLength;
		if (name.endsWith("/")) continue;

		if (flags & 1) throw new ZipError("Encrypted packages aren't supported.");
		unpacked += size;
		if (unpacked > MAX_UNPACKED_BYTES) throw new ZipError("This package is too large to open here.");
		if (local + 30 > bytes.length || view.getUint32(local, true) !== LOCAL) throw new ZipError("This isn't a valid zip package.");
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		if (start + compressed > bytes.length) throw new ZipError("This package is truncated.");

		const raw = bytes.slice(start, start + compressed);
		if (method === 0) files.set(name, raw);
		else if (method === 8) files.set(name, await inflate(raw, size));
		else throw new ZipError("This package uses an unsupported compression method.");
	}
	return files;
}
