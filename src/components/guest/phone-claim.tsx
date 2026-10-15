"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { api, reloadTo } from "@/lib/live-client";
import { roleOf } from "@/lib/repo/remote";
import type { LiveUser } from "@/lib/repo";
import { ROLE_HOME } from "@/lib/roles";

/**
 * A phone opened the QR code from a sample region: sign it in as that farmer.
 * The sign-in runs from the page (not on a plain link visit), so link previews in
 * chat apps cannot use it up or sign anyone in.
 */
export function PhoneClaim() {
  const { t } = useT();
  const token = useSearchParams().get("t") ?? "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ user: LiveUser }>("/api/guest/claim", { body: { token } })
      .then((r) => {
        const role = roleOf(r.user);
        reloadTo(role ? ROLE_HOME[role] : "/");
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="grid gap-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-soft" data-testid="phone-claim">
        <div className="flex items-center justify-center gap-3">
          <LogoMark className="size-11" />
          <Smartphone className="size-6 text-primary" aria-hidden />
        </div>
        {failed ? (
          <>
            <p role="alert" className="font-semibold text-danger-strong">
              {t.guest.phoneFailed}
            </p>
            <Button asChild variant="outline">
              <Link href="/">{t.common.goHome}</Link>
            </Button>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-lg font-semibold" role="status">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden /> {t.guest.phoneOpening}
          </p>
        )}
      </div>
    </div>
  );
}
