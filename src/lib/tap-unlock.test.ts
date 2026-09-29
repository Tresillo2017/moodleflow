import { describe, expect, it } from "vitest";
import { createTapCounter } from "./tap-unlock";

describe("createTapCounter", () => {
	it("unlocks after the required number of quick taps", () => {
		let time = 0;
		const counter = createTapCounter(3, 1000, () => time);
		expect(counter.tap()).toBe(2);
		time += 200;
		expect(counter.tap()).toBe(1);
		time += 200;
		expect(counter.tap()).toBe(0);
	});

	it("starts over after a pause and after unlocking", () => {
		let time = 0;
		const counter = createTapCounter(3, 1000, () => time);
		counter.tap();
		counter.tap();
		time += 5000;
		expect(counter.tap()).toBe(2);
		counter.tap();
		expect(counter.tap()).toBe(0);
		expect(counter.tap()).toBe(2);
	});
});
