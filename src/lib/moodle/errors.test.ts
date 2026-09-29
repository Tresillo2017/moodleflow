import { describe, expect, it } from "vitest";
import { moodleExceptionToError } from "./errors";

describe("moodleExceptionToError", () => {
	it("maps known error codes to friendly messages", () => {
		expect(moodleExceptionToError("invalidtoken").code).toBe("invalid_token");
		expect(moodleExceptionToError("accessexception").code).toBe("access_denied");
		expect(moodleExceptionToError("invalidrecord").code).toBe("unsupported_function");
	});

	it("never surfaces raw Moodle text for unknown codes", () => {
		const error = moodleExceptionToError("dmlreadexception");
		expect(error.code).toBe("unknown_error");
		expect(error.message).toBe("Moodle couldn't complete that request.");
		expect(error.moodleCode).toBe("dmlreadexception");
	});
});
