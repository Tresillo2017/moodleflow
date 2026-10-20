declare function GM_addStyle(css: string): HTMLStyleElement;
declare function GM_getValue(key: string, def?: string): string;
declare function GM_setValue(key: string, value: string): void;
declare function GM_setClipboard(text: string, type?: string): void;
declare function GM_registerMenuCommand(name: string, fn: () => void): void;
declare function GM_xmlhttpRequest(d: { url: string; method?: string; timeout?: number; anonymous?: boolean; onload: (r: { status: number; responseText: string }) => void; onerror: () => void; ontimeout: () => void }): void;
declare module "*.css" { const css: string; export default css; }
declare const __VERSION__: string;
declare module "*.json" { const data: unknown; export default data; }
