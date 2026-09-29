import type { Metadata } from "next";
import { Hanken_Grotesk, Instrument_Serif, Inconsolata } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { MoodleProvider } from "@/components/providers/moodle-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { WhatsNew } from "@/components/whats-new";
import { UpdatePrompt } from "@/components/update-prompt";
import { PREFERENCES_SCRIPT } from "@/lib/preferences";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });

const instrumentSerif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

const inconsolata = Inconsolata({ variable: "--font-inconsolata", subsets: ["latin"] });

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
		<html lang="en" suppressHydrationWarning className={`${hanken.variable} ${instrumentSerif.variable} ${inconsolata.variable}`}>
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
								<UpdatePrompt />
								<WhatsNew />
							</TooltipProvider>
						</MoodleProvider>
					</PreferencesProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
