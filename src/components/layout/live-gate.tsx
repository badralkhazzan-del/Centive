"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Info, LayoutGrid, Loader2 } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { OpenPlatformButton } from "@/components/guest/open-platform";
import { useHydrated } from "@/components/layout/providers";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { useAppData, useLiveMode, useLiveUser } from "@/lib/repo";

/** Pages that work without signing in (landing, sign-in, public trace, static info). */
const PUBLIC = ["/login", "/signup", "/join", "/phone", "/about", "/simulation", "/trace", "/settings"];

export function isPublicPath(pathname: string) {
  return pathname === "/" || PUBLIC.some((p) => pathname.startsWith(p));
}

/**
 * Workspace screens need a signed-in browser: an account, or a guest copy of the
 * sample region. Until the data has loaded they show a loading screen, so nobody
 * sees (or acts on) the placeholder data that is prerendered into the page.
 */
export function LiveGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ready = useHydrated();
  const signedIn = useLiveMode();
  if (isPublicPath(pathname)) return <>{children}</>;
  if (!ready) return <Loading />;
  if (!signedIn) {
    return (
      <Suspense fallback={<Loading />}>
        <OpenCard path={pathname} />
      </Suspense>
    );
  }
  return (
    <>
      <SampleBanner />
      {children}
    </>
  );
}

function Loading() {
  const { t } = useT();
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center text-muted" role="status" aria-live="polite">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      <p className="text-lg font-semibold text-foreground">{t.live.loading}</p>
    </div>
  );
}

/** Someone opened a workspace screen without signing in: one click opens it. */
function OpenCard({ path }: { path: string }) {
  const { t } = useT();
  const ended = useSearchParams().get("ended");
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12">
      <div className="grid gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:p-8" data-testid="open-card">
        <LogoMark className="size-11" />
        <h1 className="text-2xl font-extrabold">{t.guest.gateTitle}</h1>
        {ended ? (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm font-semibold text-warn-strong" role="status">
            {t.guest.ended}
          </p>
        ) : null}
        <p className="text-muted">{t.guest.gateBody}</p>
        <OpenPlatformButton path={path} testId="gate-open" />
        <p className="text-sm">
          {t.guest.haveAccount}{" "}
          <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/login?next=${encodeURIComponent(path)}`}>
            {t.live.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}

function SampleBanner() {
  const data = useAppData();
  const user = useLiveUser();
  const { t } = useT();
  if (!data.workspace?.sample || user?.role === "farmer") return null;
  if (user?.guest) {
    return (
      <div className="hide-in-poster border-b border-warn/40 bg-warn-soft" data-testid="sample-banner">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm text-warn-strong">
          <Info className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{t.guest.banner}</span>
          {user.role === "admin" ? (
            <Button asChild variant="ghost" size="sm" className="text-warn-strong">
              <Link href="/explore">
                <LayoutGrid aria-hidden /> {t.guest.home}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
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
