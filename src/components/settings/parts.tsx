"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rounded icon tile used in the Settings card headings. */
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-strong", className)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

/** Horizontal scroll container for wide tables, reachable by keyboard. */
export function ScrollTable({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn("-mx-5 overflow-x-auto px-5 pb-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring", className)}
    >
      {children}
    </div>
  );
}

export const TH = "px-2 py-2 text-left text-xs font-semibold text-muted first:pl-0";
export const TD = "px-2 py-2.5 align-top first:pl-0";
