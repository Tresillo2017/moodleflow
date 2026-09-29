/** Counts rapid taps: `tap()` returns how many are still needed (0 = unlocked). The count resets after a pause. */
export function createTapCounter(required: number, resetMs: number, now: () => number = Date.now) {
	let count = 0;
	let last = 0;
	return {
		tap(): number {
			const t = now();
			count = t - last > resetMs ? 1 : count + 1;
			last = t;
			if (count >= required) {
				count = 0;
				return 0;
			}
			return required - count;
		},
	};
}
