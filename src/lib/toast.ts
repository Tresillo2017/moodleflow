import { sileo, type SileoOptions } from "sileo";

type Options = Omit<SileoOptions, "title">;
const make = (fire: (opts: SileoOptions) => string) => (title: string, options?: Options) => fire({ title, ...options });

/** Thin wrapper over Sileo so call sites read `toast.success("Saved")`. */
export const toast = {
	success: make(sileo.success),
	error: make(sileo.error),
	info: make(sileo.info),
	warning: make(sileo.warning),
	action: make(sileo.action),
	loading: make((opts) => sileo.show({ ...opts, type: "loading" })),
	promise: sileo.promise,
	dismiss: sileo.dismiss,
	clear: sileo.clear,
};
