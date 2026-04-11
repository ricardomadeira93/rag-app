import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition-all duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)] px-4 py-2 text-white hover:bg-[var(--accent-text)] active:scale-[0.97]",
        secondary: "border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-[0.97]",
        ghost: "px-3 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] active:scale-[0.97]",
        soft: "bg-[var(--bg-subtle)] px-4 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-active)] active:scale-[0.97]",
      },
      size: {
        default: "h-10",
        sm: "h-8 px-3 text-[12px]",
        lg: "h-11 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
