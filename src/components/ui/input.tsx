import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-semibold text-foreground", className)} {...props} />;
}
