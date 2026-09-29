import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { MoodleProvider } from "@/components/providers/moodle-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PREFERENCES_SCRIPT } from "@/lib/preferences";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: { default: "MoodleFlow", template: "%s · MoodleFlow" },
	description: "A modern interface for Moodle.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		// Font variables live on <html> because --app-font resolves them at :root.
		<html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
			<head>
				<script dangerouslySetInnerHTML={{ __html: PREFERENCES_SCRIPT }} />
			</head>
			<body className="antialiased">
				<ThemeProvider>
					<PreferencesProvider>
						<MoodleProvider>
							<TooltipProvider>
								{children}
								<Toaster />
							</TooltipProvider>
						</MoodleProvider>
					</PreferencesProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
