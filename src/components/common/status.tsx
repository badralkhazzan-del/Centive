"use client";

import { CircleAlert, CircleCheck, Minus, Sparkles, TriangleAlert } from "lucide-react";
import type { CoverageStatus } from "@/engines/matching";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export type StatusKind = CoverageStatus | "surplus";

const STYLES: Record<StatusKind, { cls: string; bar: string; Icon: typeof CircleCheck }> = {
  green: { cls: "bg-ok-soft text-ok-strong", bar: "bg-ok", Icon: CircleCheck },
  yellow: { cls: "bg-warn-soft text-warn-strong", bar: "bg-warn", Icon: TriangleAlert },
  red: { cls: "bg-danger-soft text-danger-strong", bar: "bg-danger", Icon: CircleAlert },
  none: { cls: "bg-muted-surface text-muted", bar: "bg-border-strong", Icon: Minus },
  surplus: { cls: "bg-ok-soft text-ok-strong", bar: "bg-ok", Icon: Sparkles },
};

export function barColor(status: StatusKind) {
  return STYLES[status].bar;
}

/** Traffic light: always color + icon + label, never color alone. */
export function StatusPill({ status, label, className, size = "md" }: { status: StatusKind; label?: string; className?: string; size?: "sm" | "md" }) {
  const { t } = useT();
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        s.cls,
        className,
      )}
      data-status={status}
    >
      <s.Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {label ?? t.status[status]}
    </span>
  );
}

export function ProgressBar({
  pct,
  offeredPct = 0,
  status,
  label,
  className,
  testId,
}: {
  pct: number;
  offeredPct?: number;
  status: StatusKind;
  label: string;
  className?: string;
  testId?: string;
}) {
  const filled = Math.max(0, Math.min(1, pct));
  const offered = Math.max(0, Math.min(1 - filled, offeredPct));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      data-testid={testId}
      data-value={Math.round(pct * 100)}
      className={cn("relative h-3.5 w-full overflow-hidden rounded-full bg-muted-surface", className)}
    >
      <div className={cn("bar-fill absolute inset-y-0 left-0 rounded-full", barColor(status))} style={{ width: `${filled * 100}%` }} />
      {offered > 0 ? (
        <div
          className={cn("bar-fill striped absolute inset-y-0 rounded-r-full opacity-50", barColor(status === "red" ? "yellow" : status))}
          style={{ left: `${filled * 100}%`, width: `${offered * 100}%` }}
        />
      ) : null}
      <div className="absolute inset-y-0 border-l-2 border-foreground/30" style={{ left: "80%" }} aria-hidden />
    </div>
  );
}
