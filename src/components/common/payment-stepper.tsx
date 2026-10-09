"use client";

import type { PaymentStatus } from "@/engines/payment";
import { STAGES } from "@/engines/payment";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/** The four Payment Clock stages as a compact progress strip. */
export function PaymentStepper({ status, className }: { status: PaymentStatus; className?: string }) {
  const { t } = useT();
  const L = t.kopdes.payments;
  return (
    <ol className={cn("grid grid-cols-4 gap-1", className)} aria-label={L.title}>
      {STAGES.map((s, i) => {
        const done = i <= status.stageIndex;
        return (
          <li key={s} className="grid grid-cols-1 gap-1" aria-current={i === status.stageIndex ? "step" : undefined}>
            <span className={cn("h-1.5 rounded-full", done ? (status.overdue && i === status.stageIndex ? "bg-danger" : "bg-ok") : "bg-muted-surface")} />
            <span className={cn("text-[11px] leading-tight", done ? "font-semibold text-foreground" : "text-muted")}>{L.stages[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}
