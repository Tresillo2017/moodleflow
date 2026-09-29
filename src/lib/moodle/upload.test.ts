import { describe, expect, it } from "vitest";
import { checkUploadSize } from "./upload";

describe("checkUploadSize", () => {
	it("passes files within the limit and when there is no limit", () => {
		expect(() => checkUploadSize([{ name: "a.pdf", size: 1000 }], 2000)).not.toThrow();
		expect(() => checkUploadSize([{ name: "a.pdf", size: 1e9 }], 0)).not.toThrow();
		expect(() => checkUploadSize([{ name: "a.pdf", size: 1e9 }])).not.toThrow();
	});

	it("names the offending file and both sizes", () => {
		expect(() => checkUploadSize([{ name: "big.zip", size: 20 * 1024 * 1024 }], 10 * 1024 * 1024)).toThrow(/big\.zip is 20 MB.*10 MB/);
	});
});
