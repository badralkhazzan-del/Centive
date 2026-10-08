"use client";

import { Info } from "lucide-react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/** The plain-language "Why?" line every alert and suggestion carries. */
export function WhyLine({ children, className }: { children: React.ReactNode; className?: string }) {
  const { t } = useT();
  return (
    <p className={cn("flex gap-2 rounded-xl bg-muted-surface px-3 py-2 text-sm text-foreground", className)}>
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="font-bold">{t.common.why}</span> {children}
      </span>
    </p>
  );
}
