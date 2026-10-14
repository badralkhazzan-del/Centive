"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Info, Loader2 } from "lucide-react";
import { useHydrated } from "@/components/layout/providers";
import { useT } from "@/i18n";
import { useAppData, useLiveMode, useLiveUser } from "@/lib/repo";

/** Pages that work without the workspace data (sign-in, public trace, static info). */
const PUBLIC = ["/login", "/signup", "/join", "/about", "/simulation", "/trace"];

/**
 * Live mode: keeps role screens out of view until the workspace has loaded, so
 * nobody sees (or acts on) the demo data that is prerendered into the page.
 */
export function LiveGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ready = useHydrated();
  const { t } = useT();
  const isLive = useLiveMode();
  if (!isLive || PUBLIC.some((p) => pathname.startsWith(p))) return <>{children}</>;
  if (!ready) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center text-muted" role="status" aria-live="polite">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-lg font-semibold text-foreground">{t.live.loading}</p>
      </div>
    );
  }
  return (
    <>
      <SampleBanner />
      {children}
    </>
  );
}

function SampleBanner() {
  const data = useAppData();
  const user = useLiveUser();
  const { t } = useT();
  if (!data.workspace?.sample || user?.role === "farmer") return null;
  return (
    <div className="hide-in-poster border-b border-warn/40 bg-warn-soft" data-testid="sample-banner">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm text-warn-strong">
        <Info className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">{t.live.sampleBanner}</span>
        {user?.role === "admin" ? (
          <Link href="/manage" className="inline-flex min-h-11 items-center font-bold underline underline-offset-4">
            {t.live.sampleAction}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
