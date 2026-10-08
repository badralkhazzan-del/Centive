import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-soft text-primary-strong",
        outline: "border-border text-foreground",
        accent: "border-transparent bg-accent-soft text-accent-strong",
        danger: "border-transparent bg-danger-soft text-danger-strong",
        muted: "border-transparent bg-muted-surface text-muted",
        green: "border-transparent bg-ok-soft text-ok-strong",
        yellow: "border-transparent bg-warn-soft text-warn-strong",
        red: "border-transparent bg-danger-soft text-danger-strong",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
