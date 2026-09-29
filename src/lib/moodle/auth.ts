import { MoodleError } from "@/types/moodle";

const MOBILE_SERVICE = "moodle_mobile_app";

/**
 * Exchanges a Moodle username/password for a web service token via
 * login/token.php. Requires the site to have web services + the mobile
 * service (or another service the user is authorized for) enabled.
 */
export async function fetchMoodleToken(
	siteUrl: string,
	username: string,
	password: string,
	service: string = MOBILE_SERVICE,
): Promise<string> {
	const url = new URL("/login/token.php", siteUrl);
	const body = new URLSearchParams();
	body.set("username", username);
	body.set("password", password);
	body.set("service", service);

	let response: Response;
	try {
		response = await fetch(url.toString(), {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
		});
	} catch {
		throw new MoodleError(
			"network_error",
			"Couldn't reach the Moodle server. Check the site URL and your connection.",
		);
	}

	if (!response.ok) {
		throw new MoodleError("site_unavailable", `Moodle responded with status ${response.status}.`);
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new MoodleError("malformed_response", "Moodle returned a response that couldn't be parsed.");
	}

	if (!data || typeof data !== "object") {
		throw new MoodleError("malformed_response", "Moodle returned a response that couldn't be parsed.");
	}
	const r = data as { token?: string; error?: string; errorcode?: string };

	if (r.errorcode === "missingparam" || r.errorcode === "servicenotdefined" || r.errorcode === "invalidlogin") {
		throw new MoodleError("invalid_token", r.error ?? "Incorrect username or password.");
	}
	if (r.error) {
		throw new MoodleError("unknown_error", r.error);
	}
	if (!r.token) {
		throw new MoodleError("malformed_response", "Moodle didn't return a token.");
	}
	return r.token;
}
