import type { Metadata } from "next";
import { Darumadrop_One, Geist_Mono, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Footer } from "./_components/footer/footer";
import { Header } from "./_components/header/header";

const funnel = Hanken_Grotesk({
	variable: "--font-funnel",
	subsets: ["latin"]
});

const brand = Darumadrop_One({
	weight: "400",
	subsets: ["latin"]
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const SITE_URL = "https://moodleflow.tomasps.workers.dev";
const TITLE = "moodleflow, bleh for Moodle";
const DESCRIPTION = "A fresh coat of paint for Moodle, bringing you closer to the courses that matter. A userscript port of bleh by katelyn.";

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: TITLE,
	description: DESCRIPTION,
	keywords: ["moodle", "moodle userscript", "moodle theme", "dark mode", "dark theme", "light theme", "violentmonkey", "tampermonkey", "userscript", "bleh", "bleh for moodle", "katelyn", "glass", "student", "course", "classroom"],
	openGraph: {
		images: "/shots/hero.webp",
		type: "website",
		url: SITE_URL,
		title: TITLE,
		description: DESCRIPTION,
		siteName: "moodleflow"
	}
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${funnel.variable} ${geistMono.variable}`}>
				<Header />
				<main>
					{children}
				</main>
				<Footer />
			</body>
		</html>
	);
}
