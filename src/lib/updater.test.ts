import { afterEach, describe, expect, it, vi } from "vitest";
import { applyUpdate, checkForUpdate, isUpdateAvailable } from "./updater";
import { PENDING_VERSION_KEY } from "./whats-new";

describe("isUpdateAvailable", () => {
	it("is true only when a different build is deployed", () => {
		expect(isUpdateAvailable("0.13.0+abc1234", "0.13.0+def5678")).toBe(true);
		expect(isUpdateAvailable("0.13.0", "0.14.0")).toBe(true);
		expect(isUpdateAvailable("0.13.0", "0.13.0")).toBe(false);
		expect(isUpdateAvailable("0.13.0", undefined)).toBe(false);
	});
});

describe("checkForUpdate / applyUpdate", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("reports an error when the version endpoint fails, then finds the update", async () => {
		const storage = new Map<string, string>();
		const reload = vi.fn();
		vi.stubGlobal("window", {
			localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
			location: { reload },
		});
		vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }));
		expect(await checkForUpdate()).toBe("error");

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "9.9.9", build: "9.9.9+abc" }) }));
		expect(await checkForUpdate()).toBe("available");

		vi.useFakeTimers();
		applyUpdate();
		expect(storage.get(PENDING_VERSION_KEY)).toBe("9.9.9");
		vi.runAllTimers();
		expect(reload).toHaveBeenCalledOnce();
	});
});
