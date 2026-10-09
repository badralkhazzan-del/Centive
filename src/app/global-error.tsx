"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import localFont from "next/font/local";
import "./globals.css";
import { House, RotateCcw, TriangleAlert } from "lucide-react";
import { StatusScreen } from "@/components/about/status-screen";
import { en } from "@/i18n/en";
import { id } from "@/i18n/id";

// The root layout's font class is gone when this file replaces it, so load the same
// self-hosted Plus Jakarta Sans here (otherwise the screen falls back to system fonts).
const jakarta = localFont({
  src: [
    { path: "./fonts/PlusJakartaSans-latin.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/PlusJakartaSans-latin-ext.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

/** English on top, Indonesian below as one block, so the two never wrap into ragged columns. */
function BilingualLabel({ en: enText, id: idText }: { en: string; id: string }) {
  return (
    <span className="flex flex-col items-start text-left leading-tight">
      <span>{enText}</span>
      <span lang="id" className="text-sm font-medium italic">
        {idText}
      </span>
    </span>
  );
}

// Replaces the root layout when the layout itself fails, so it renders its own
// <html> and <body> and avoids the app store and providers. It shows both
// languages because the saved language preference may be what broke.
export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const btn =
    "inline-flex min-h-13 items-center justify-center gap-3 rounded-xl px-6 py-2 text-lg font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:size-5";

  return (
    <html lang="en" className={jakarta.variable}>
      <body className="flex min-h-dvh flex-col justify-center bg-background font-sans text-foreground antialiased">
        <title>{`${en.common.errorTitle} · PiringTani`}</title>
        <main id="main">
          <StatusScreen
            testId="global-error"
            tone="danger"
            live
            badge={<TriangleAlert />}
            title={
              <>
                {en.common.errorTitle}
                <span lang="id" className="mt-1 block text-xl font-semibold italic text-muted sm:text-2xl">
                  {id.common.errorTitle}
                </span>
              </>
            }
            body={
              <>
                {en.common.errorBody}
                <span lang="id" className="mt-2 block text-base italic">
                  {id.common.errorBody}
                </span>
              </>
            }
            actions={
              <>
                <button type="button" onClick={() => (retry ?? reset)?.()} className={`${btn} border border-transparent bg-primary text-primary-foreground hover:bg-primary-hover`}>
                  <RotateCcw aria-hidden />
                  <BilingualLabel en={en.common.tryAgain} id={id.common.tryAgain} />
                </button>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load rebuilds the broken root layout */}
                <a href="/" className={`${btn} border border-border bg-surface hover:bg-muted-surface`}>
                  <House aria-hidden />
                  <BilingualLabel en={en.common.goHome} id={id.common.goHome} />
                </a>
              </>
            }
          />
        </main>
      </body>
    </html>
  );
}
