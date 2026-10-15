"use client";

import { useHydrated } from "@/components/layout/providers";
import { Skeleton } from "@/components/ui/skeleton";

/** Shows a loading skeleton until the workspace data has loaded. */
export function HydrationGate({ children, rows = 3 }: { children: React.ReactNode; rows?: number }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
