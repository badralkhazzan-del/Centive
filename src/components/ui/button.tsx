import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        secondary: "bg-primary-soft text-primary-strong hover:bg-primary-soft-hover",
        outline: "border border-border bg-surface text-foreground hover:bg-muted-surface",
        ghost: "text-foreground hover:bg-muted-surface",
        accent: "bg-accent text-accent-foreground shadow-sm hover:bg-accent-hover",
        destructive: "bg-danger text-white shadow-sm hover:bg-danger-hover",
        link: "text-primary underline-offset-4 hover:underline px-0 min-h-0",
      },
      size: {
        default: "min-h-11 px-5 py-2",
        sm: "min-h-11 px-3 text-sm",
        lg: "min-h-13 px-6 text-lg",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
