"use client";

import { browserName, isIOS } from "react-device-detect";
import styles from "./browser.module.css";
import { ComponentPropsWithoutRef } from "react";

interface BrowserListHelperProps {
	selectedBrowser: browserKey,
	setSelectedBrowser: Function,
	setStep: Function
}

export function BrowserListHelper({
	selectedBrowser,
	setSelectedBrowser,
	setStep
}: BrowserListHelperProps) {
	let browsers: browserKey[] = [
		"chrome",
		"firefox",
		"safari"
	];

	const chrome_browsers = [
		"Chrome",
		"Opera",
		"Yandex",
		"Chromium",
		"Edge"
	];
	const firefox_browsers = [
		"Firefox"
	];
	const safari_browsers = [
		"Safari",
		"Mobile Safari"
	];

	const unsupported_browsers = [
		"IE",
		"Internet Explorer",
		"MIUI Browser",
		"Samsung Browser"
	];

	const browser = browserName;
	let standardised_browser: browserKey = "chrome";

	const chrome = isChrome(browser);
	const firefox = isFirefox(browser);
	const safari = isSafari(browser);

	if (chrome) {
		standardised_browser = "chrome";
	} else if (firefox) {
		standardised_browser = "firefox";
	} else if (safari) {
		standardised_browser = "safari";
	}

	// any browser on iOS except for safari does not support extensions
	const unsupported = unsupported_browsers.includes(browser) || (!safari && isIOS);

	if (standardised_browser) {
		browsers = browsers.filter(b => b != standardised_browser);

		return (
			<>
				<div className={styles.list}>
					<Browser browser={standardised_browser} onClick={() => setBrowser(standardised_browser)} />
				</div>
				<p className={styles.browser_tip}>
					It looks like you’re using <i>{browser}</i> or something similar to it.
				</p>
				<div className={styles.list}>
					{browsers.map((b, i) => <Browser browser={b} key={i} onClick={() => setBrowser(b)} />)}
				</div>
			</>
		)
	}

	return (
		<>
			<div className={styles.list}>
				{browsers.map((b, i) => <Browser browser={b} key={i} onClick={() => setBrowser(b)} />)}
			</div>
		</>
	)

	interface BrowserProps {
		browser: string
	}

	function isFirefox(browser: string) {
		return firefox_browsers.includes(browser);
	}

	function isChrome(browser: string) {
		return chrome_browsers.includes(browser);
	}

	function isSafari(browser: string) {
		return safari_browsers.includes(browser);
	}

	function setBrowser(browser: string) {
		setSelectedBrowser(browser);
		setStep(1);
	}
}

type BrowserProps = {
	browser: browserKey
} & ComponentPropsWithoutRef<"button">;

function Browser({
	browser,
	...props
}: BrowserProps) {
	return (
		<button className={styles.browser} {...props}>
			<img src={`/${browser}.svg`} alt={browser} />
			{browser.charAt(0).toUpperCase() + browser.slice(1)}
		</button>
	)
}

interface ExtensionListProps {
	browser: browserKey,
	selectedExtension: string,
	setSelectedExtension: Function,
	setStep: Function
}

export type browserKey = "chrome" | "firefox" | "safari";

interface ExtensionItemProps {
	name: string,
	url: string
}

export function ExtensionList({
	browser,
	selectedExtension,
	setSelectedExtension,
	setStep
}: ExtensionListProps) {
	const extensions: Record<browserKey, ExtensionItemProps[]> = {
		chrome: [
			{
				name: "Violentmonkey",
				url: "https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag"
			},
			{
				name: "Tampermonkey",
				url: "https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo"
			}
		],
		firefox: [
			{
				name: "Violentmonkey",
				url: "https://addons.mozilla.org/firefox/addon/violentmonkey"
			},
			{
				name: "Tampermonkey",
				url: "https://addons.mozilla.org/firefox/addon/tampermonkey"
			}
		],
		safari: [
			{
				name: "Tampermonkey",
				url: "https://apps.apple.com/us/app/tampermonkey/id6738342400"
			}
		]
	};

	const notice = {
		chrome: "Violentmonkey is the open source option, Tampermonkey is closed source. Either one works with moodleflow.",
		firefox: "Violentmonkey is the open source option, Tampermonkey is closed source.",
		safari: "There is a payment for this userscript extension on iOS, however on macOS, simply install Chrome or Firefox and head back to this site!"
	}

	return (
		<>
			<div className={styles.list}>
				{extensions[browser].map((e, i) => <Extension extension={e} browser={browser} key={i} onClick={() => setExtension(e)} />)}
			</div>
			<div className={styles.notice}>
				{notice[browser]}
			</div>
		</>
	)

	function setExtension(extension: ExtensionItemProps) {
		setSelectedExtension(extension.name);
		window.open(extension.url, "_blank");
		setStep(2);
	}
}

type ExtensionProps = {
	extension: ExtensionItemProps,
	browser: browserKey
} & ComponentPropsWithoutRef<"button">;

function Extension({
	extension,
	browser,
	...props
}: ExtensionProps) {
	const svg = extension.name.toLowerCase() == "tampermonkey" ? "svg" : "png";

	return (
		<button className={styles.browser} {...props}>
			<img src={`/${extension.name.toLowerCase()}.${svg}`} alt={extension.name} />
			{extension.name}
		</button>
	)
}
