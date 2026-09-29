export { cn } from "cn"

/** Links built from Moodle payloads: only allow http(s), never javascript:/data: schemes. */
export function isHttpUrl(url: string | undefined): url is string {
	return typeof url === "string" && /^https?:\/\//i.test(url)
}
