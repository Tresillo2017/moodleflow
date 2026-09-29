import { afterEach, describe, expect, it, vi } from "vitest";
import { callMoodle, callMoodleBatch, moodleUrl } from "./call";

const connection = { siteUrl: "https://moodle.example.com", token: "SECRET" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("callMoodle", () => {
	it("retries a GET after a network failure", async () => {
		const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(json({ ok: 1 }));
		vi.stubGlobal("fetch", fetchMock);
		await expect(callMoodle(connection, "core_x")).resolves.toEqual({ ok: 1 });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("never retries a POST", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
		vi.stubGlobal("fetch", fetchMock);
		await expect(callMoodle(connection, "core_x", {}, "POST")).rejects.toMatchObject({ code: "network_error" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("hides raw Moodle exception text", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ exception: "dml_read_exception", errorcode: "dmlreadexception", message: "SELECT * FROM secret" })));
		const error = await callMoodle(connection, "core_x").catch((e: Error) => e);
		expect((error as Error).message).not.toContain("SELECT");
	});
});

describe("callMoodleBatch", () => {
	it("sends one request and maps data and errors in order", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			json({
				responses: [
					{ error: false, data: JSON.stringify({ a: 1 }) },
					{ error: true, exception: JSON.stringify({ errorcode: "accessexception" }) },
				],
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const results = await callMoodleBatch(connection, [
			{ wsfunction: "f1", params: { id: 1 } },
			{ wsfunction: "f2", params: { id: 2 } },
		]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(results[0]).toEqual({ data: { a: 1 } });
		expect(results[1]).toMatchObject({ error: { code: "access_denied" } });
	});
});

describe("moodleUrl", () => {
	it("targets the proxy with the site as a parameter", () => {
		const url = moodleUrl({ ...connection, proxy: true }, "/webservice/rest/server.php");
		expect(url.pathname).toBe("/api/moodle/webservice/rest/server.php");
		expect(url.searchParams.get("moodle_site")).toBe("https://moodle.example.com");
	});
});
