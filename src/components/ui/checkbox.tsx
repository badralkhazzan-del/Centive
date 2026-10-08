import * as React from "react";
import { cn } from "@/lib/utils";

/** Large, accessible checkbox row (44px+ target). */
export function CheckboxRow({
  id,
  checked,
  onChange,
  children,
  className,
  testId,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-13 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-base transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring",
        checked ? "border-ok/40 bg-ok-soft" : "border-border bg-surface hover:bg-muted-surface",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={testId}
        className="size-6 shrink-0 cursor-pointer accent-[#1f6f4a]"
      />
      <span className="font-semibold">{children}</span>
    </label>
  );
}
