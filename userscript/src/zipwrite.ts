// A minimal zip writer (stored, no compression: images are already compressed and the text is tiny). Pure, no DOM.
export type ZipEntry = { name: string; data: Uint8Array };

const TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
	return t;
})();

export function crc32(data: Uint8Array): number {
	let c = 0xffffffff;
	for (const b of data) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

const dosTime = (d: Date): number => (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
const dosDate = (d: Date): number => (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

/** Builds a zip archive (UTF-8 names) from the entries, in order. */
export function zip(entries: readonly ZipEntry[], date: Date = new Date()): Uint8Array {
	const enc = new TextEncoder();
	const parts: Uint8Array[] = [], central: Uint8Array[] = [];
	let offset = 0;
	for (const { name, data } of entries) {
		const nameBytes = enc.encode(name), crc = crc32(data);
		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); // version 2.0, UTF-8 names
		local.setUint16(10, dosTime(date), true); local.setUint16(12, dosDate(date), true);
		local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, nameBytes.length, true);
		parts.push(new Uint8Array(local.buffer), nameBytes, data);
		const head = new DataView(new ArrayBuffer(46));
		head.setUint32(0, 0x02014b50, true); head.setUint16(4, 20, true); head.setUint16(6, 20, true); head.setUint16(8, 0x0800, true);
		head.setUint16(12, dosTime(date), true); head.setUint16(14, dosDate(date), true);
		head.setUint32(16, crc, true); head.setUint32(20, data.length, true); head.setUint32(24, data.length, true); head.setUint16(28, nameBytes.length, true);
		head.setUint32(42, offset, true);
		central.push(new Uint8Array(head.buffer), nameBytes);
		offset += 30 + nameBytes.length + data.length;
	}
	const size = central.reduce((n, p) => n + p.length, 0);
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
	end.setUint32(12, size, true); end.setUint32(16, offset, true);
	const all = [...parts, ...central, new Uint8Array(end.buffer)];
	const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const p of all) { out.set(p, at); at += p.length; }
	return out;
}
