"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useMoodleConnection } from "@/components/providers/moodle-provider";
import { useMoodleQuery } from "@/hooks/use-moodle-query";
import { useUnreadCount } from "@/hooks/use-unread-count";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { useLoaderActive } from "@/lib/loader";
import { NAV_ITEMS, NOTIFICATIONS_ITEM, SETTINGS_ITEM } from "@/lib/nav";
import { ditherHueOf } from "@/lib/preferences";
import { AccountMenu, Masthead, UserPicture, type ShellUser } from "./masthead";
import { SeasonParticles } from "./season-particles";

const WIDTHS = { normal: "64rem", wide: "80rem", full: "100%" } as const;
const HOME = "/dashboard";
const MOBILE_ITEMS = NAV_ITEMS.filter((i) => ["/dashboard", "/courses", "/assignments", "/messages"].includes(i.href));
const REPO_URL = "https://github.com/Tresillo2017/moodleflow";
const GREETING_REFRESH_MS = 60_000;
/** Moodle's generated "no picture" silhouettes (…/u/f1, f2, f3): treat as no picture. */
const DEFAULT_PICTURE = /\/u\/f\d$/;

/** bleh's buckets: night 22-06, morning 07-10, afternoon 11-18, evening 19-21. */
export function greetingFor(hour: number): string {
	if (hour >= 22 || hour < 7) return "Good night";
	if (hour < 11) return "Good morning";
	if (hour < 19) return "Good afternoon";
	return "Good evening";
}

function useShellUser(): ShellUser {
	const { client, connection } = useMoodleConnection();
	const info = useMoodleQuery(client ? () => client.getSiteInfo() : null, [client]);
	const picture = info.data?.userPictureUrl;
	return {
		name: info.data?.fullName ?? connection?.userFullName ?? "Student",
		site: connection?.siteName ?? connection?.siteUrl ?? "",
		picture: picture && !DEFAULT_PICTURE.test(picture) ? picture : null,
	};
}

/** The soft blurred glow behind the page: the user's picture, or the accent when there is none. */
function PageBackdrop({ src }: { src: string | null }) {
	const [ready, setReady] = useState(false);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setReady(true));
		return () => cancelAnimationFrame(frame);
	}, []);
	return (
		<div className="sh-backdrop" data-ready={ready ? "" : undefined} aria-hidden="true">
			<div className="sh-backdrop-img" style={src ? { backgroundImage: `url(${src})` } : undefined} />
		</div>
	);
}

/** The strip behind hero and tab row: a dithered accent gradient, faded at both ends. */
function HeroBanner({ src }: { src: string | null }) {
	const { prefs } = usePreferences();
	return (
		<div className="sh-banner" aria-hidden="true">
			{src ? (
				<div key={src} className="sh-banner-img animate-fade" style={{ backgroundImage: `url(${src})` }} />
			) : (
				<div className="sh-banner-img">
					<DitherGradient from={ditherHueOf(prefs)} direction="up" opacity={0.7} />
				</div>
			)}
		</div>
	);
}

function useNow(intervalMs: number): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), intervalMs);
		return () => clearInterval(id);
	}, [intervalMs]);
	return now;
}

/** Avatar with an accent glow, the greeting and the name. Big on the dashboard, compact elsewhere. */
function Hero({ user, isHome }: { user: ShellUser; isHome: boolean }) {
	const now = useNow(GREETING_REFRESH_MS);
	const Title = isHome ? "h1" : "p";
	return (
		<section className="sh-hero">
			<Link href="/profile" className="sh-hero-avatar" aria-label="Your profile">
				<UserPicture user={user} />
			</Link>
			<div className="sh-hero-text">
				<p className="sh-hero-eyebrow">{greetingFor(now.getHours())}</p>
				<Title className="sh-hero-title">{user.name}</Title>
			</div>
		</section>
	);
}

function CountBadge({ count }: { count: number }) {
	if (count <= 0) return null;
	return <span className="sh-count">{count > 99 ? "99+" : count}</span>;
}

/** The 46px tab row under the hero: sections on the left, Notifications and Settings on the right. */
function HeaderTabs({ pathname }: { pathname: string }) {
	const unreadMessages = useUnreadMessages();
	const unreadNotifications = useUnreadCount();
	const tab = (item: { href: string; label: string; icon: React.ElementType }, count = 0) => {
		const active = pathname.startsWith(item.href);
		return (
			<Link key={item.href} href={item.href} className="sh-tab" aria-current={active ? "page" : undefined}>
				<item.icon className="sh-tab-icon" aria-hidden="true" />
				{item.label}
				<CountBadge count={count} />
			</Link>
		);
	};
	return (
		<nav className="sh-tabs" aria-label="Sections">
			<div className="sh-tabs-list">
				{NAV_ITEMS.map((item) => tab(item, item.href === "/messages" ? unreadMessages : 0))}
				<span className="sh-tab-spacer" />
				{tab(NOTIFICATIONS_ITEM, unreadNotifications)}
				{tab(SETTINGS_ITEM)}
			</div>
		</nav>
	);
}

/** Mobile (<=980px) bottom bar: the main sections and the Me menu. */
function MobileBar({ pathname, user }: { pathname: string; user: ShellUser }) {
	const unreadMessages = useUnreadMessages();
	return (
		<nav className="sh-mobilebar" aria-label="Primary">
			<div className="sh-mobilebar-grid">
				{MOBILE_ITEMS.map((item) => (
					<Link
						key={item.href}
						href={item.href}
						className="sh-mctl"
						aria-current={pathname.startsWith(item.href) ? "page" : undefined}
					>
						<item.icon className="sh-mctl-icon" aria-hidden="true" />
						<span className="sh-mctl-label">{item.label.replace("My ", "")}</span>
						{item.href === "/messages" && unreadMessages > 0 && <span className="sh-mctl-dot" aria-hidden="true" />}
					</Link>
				))}
				<AccountMenu user={user} variant="mobile" />
			</div>
		</nav>
	);
}

/** 4px accent bar pinned to the top while any Moodle query is loading. */
function LoaderBar() {
	const active = useLoaderActive();
	return (
		<div className="sh-loader" data-active={active ? "" : undefined} aria-hidden="true">
			{active && <div className="sh-loader-bar" />}
		</div>
	);
}

const Dot = () => <span className="sh-footer-dot" aria-hidden="true" />;

function Footer() {
	return (
		<footer className="sh-footer">
			<div className="sh-footer-row">
				<span className="sh-footer-brand">MoodleFlow</span>
				<span>v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
				<Dot />
				<span>
					Made with <Heart className="sh-footer-heart" aria-label="love" /> for students
				</span>
				<Dot />
				<Link className="sh-footer-link" href="/changelog">What&apos;s new</Link>
				<Dot />
				<a className="sh-footer-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
				<Dot />
				<a className="sh-footer-link" href={`${REPO_URL}/issues/new`} target="_blank" rel="noopener noreferrer">Report an issue</a>
			</div>
		</footer>
	);
}

/**
 * Persistent chrome around every signed-in page (after sc-dashboard): backdrop, banner, masthead,
 * hero, tab row, the routed page (document scroll), footer, and the bottom bar on mobile.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
	const { prefs } = usePreferences();
	const pathname = usePathname();
	const user = useShellUser();
	const isHome = pathname === HOME;

	return (
		<div
			className="sh-root"
			data-compact={isHome ? undefined : ""}
			style={{ "--sh-width": WIDTHS[prefs.width] } as CSSProperties}
		>
			<SeasonParticles />
			<PageBackdrop src={user.picture} />
			<HeroBanner src={user.picture} />
			<Masthead user={user} />
			<LoaderBar />
			<main className="sh-main">
				<Hero user={user} isHome={isHome} />
				<HeaderTabs pathname={pathname} />
				<div className="sh-page">{children}</div>
			</main>
			<Footer />
			<MobileBar pathname={pathname} user={user} />
		</div>
	);
}
