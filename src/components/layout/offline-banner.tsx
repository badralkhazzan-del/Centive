"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useT } from "@/i18n";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function OfflineBanner() {
  const { t } = useT();
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  if (!offline) return null;
  return (
    <div role="status" className="hide-in-poster flex items-center justify-center gap-2 bg-accent-soft px-4 py-2 text-sm font-semibold text-accent-strong">
      <WifiOff className="size-4" aria-hidden />
      {t.common.offline}
    </div>
  );
}
