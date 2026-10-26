import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { ThemeProvider } from "@/components/extrarr/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "nEXTrarr",
  description: "Radarr/Sonarr metadata completion tool — themes, trailers, artwork.",
  keywords: ["nEXTrarr", "Radarr", "Sonarr", "Kodi", "Jellyfin", "theme", "trailer", "artwork"],
  authors: [{ name: "nEXTrarr Contributors" }],
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "256x256" }],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <TooltipProvider delayDuration={3000} skipDelayDuration={0}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </TooltipProvider>
        <SonnerToaster position="bottom-center" theme="system" richColors />
      </body>
    </html>
  );
}
