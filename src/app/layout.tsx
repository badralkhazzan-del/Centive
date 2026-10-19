import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/footer";
import { AppProviders } from "@/components/layout/providers";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { BOOT_SCRIPT, InlineScript } from "@/components/layout/inline-script";
import { SkipLink } from "@/components/layout/skip-link";
import { LiveGate } from "@/components/layout/live-gate";
import { en } from "@/i18n/en";

// Plus Jakarta Sans (Indonesian-designed, SIL Open Font License), self-hosted so the
// app works offline and builds without network access.
const jakarta = localFont({
  src: [
    { path: "./fonts/PlusJakartaSans-latin.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/PlusJakartaSans-latin-ext.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: en.meta.title, template: "%s · PiringTani" },
  description: en.meta.description,
  applicationName: "PiringTani",
  // Installed on an iPhone or iPad (Add to Home Screen): full screen, with this name.
  appleWebApp: { capable: true, title: "PiringTani", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1f6f4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <InlineScript html={BOOT_SCRIPT} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <AppProviders>
          <SkipLink />
          <OfflineBanner />
          <AppHeader />
          <main id="main" tabIndex={-1} className="flex-1 focus-visible:outline-none">
            <LiveGate>{children}</LiveGate>
          </main>
          <AppFooter />
        </AppProviders>
      </body>
    </html>
  );
}
