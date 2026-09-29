import { describe, expect, it } from "vitest";
import { notificationType } from "./notification-type";

describe("notificationType", () => {
	it("labels known components, messages and unknowns", () => {
		expect(notificationType({ component: "mod_forum" })).toBe("Forums");
		expect(notificationType({ component: "moodle", eventType: "instantmessage" })).toBe("Messages");
		expect(notificationType({ component: "mod_glossary" })).toBe("Glossary");
		expect(notificationType({ component: "moodle" })).toBe("Other");
		expect(notificationType({})).toBe("Other");
	});
});
