import { MoodleError, type MoodleErrorCode } from "@/types/moodle";

const DENIED: [MoodleErrorCode, string] = ["access_denied", "Your Moodle account isn't allowed to do that."];
const UNAVAILABLE: [MoodleErrorCode, string] = ["unsupported_function", "This isn't available on your Moodle site."];
const EXPIRED: [MoodleErrorCode, string] = ["invalid_token", "Your Moodle session has expired. Sign in again."];

/** Moodle `errorcode` -> [our code, message safe to show]. Anything unlisted gets the generic message. */
const KNOWN: Record<string, [MoodleErrorCode, string]> = {
	invalidtoken: EXPIRED,
	tokenexpired: EXPIRED,
	invalidlogin: ["invalid_token", "Incorrect username or password."],
	accessexception: DENIED,
	nopermissions: DENIED,
	requireloginerror: DENIED,
	forbiddenwsuser: DENIED,
	invalidrecord: UNAVAILABLE,
	invalidfunction: UNAVAILABLE,
	servicenotavailable: UNAVAILABLE,
	webservicesnotenabled: UNAVAILABLE,
	maintenance: ["site_unavailable", "Moodle is in maintenance mode. Try again later."],
	sitemaintenance: ["site_unavailable", "Moodle is in maintenance mode. Try again later."],
};

const GENERIC: [MoodleErrorCode, string] = ["unknown_error", "Moodle couldn't complete that request."];

/** Builds a user-facing error from a Moodle exception; the raw Moodle message is deliberately dropped. */
export function moodleExceptionToError(errorcode?: string): MoodleError {
	const [code, message] = (errorcode && KNOWN[errorcode]) || GENERIC;
	return new MoodleError(code, message, errorcode);
}
