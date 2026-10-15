"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { ApiError, startGuest } from "@/lib/live-client";

/** Opens a private copy of the sample region (no account), then goes to `path`. */
export function useStartGuest() {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async (path: string) => {
    setBusy(true);
    setError(null);
    try {
      await startGuest(path);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "server_error";
      const G = t.guest.errors as Record<string, string>;
      const L = t.live.errors as Record<string, string>;
      setError(G[code] ?? L[code] ?? t.live.errors.server_error);
      setBusy(false);
    }
  };
  return { start, busy, error };
}

export function GuestError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-strong">
      {text}
    </p>
  );
}

/** The main way in: one click, no account. */
export function OpenPlatformButton({ path = "/explore", size = "lg", className, testId = "open-platform" }: { path?: string; size?: "lg" | "default"; className?: string; testId?: string }) {
  const { t } = useT();
  const { start, busy, error } = useStartGuest();
  return (
    <div className="grid gap-2">
      <Button size={size} variant="accent" onClick={() => start(path)} disabled={busy} data-testid={testId} className={className}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRight aria-hidden />}
        {busy ? t.guest.opening : t.guest.open}
      </Button>
      <GuestError text={error} />
    </div>
  );
}
