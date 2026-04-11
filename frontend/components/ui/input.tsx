import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl bg-white/80 px-3 text-sm text-zinc-900 outline-none transition duration-200 placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
