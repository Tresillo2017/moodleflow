import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { MoodleProvider } from "@/components/providers/moodle-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "MoodleFlow",
	description: "A modern interface for Moodle.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<ThemeProvider>
					<MoodleProvider>
						<TooltipProvider>
							{children}
							<Toaster />
						</TooltipProvider>
					</MoodleProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
