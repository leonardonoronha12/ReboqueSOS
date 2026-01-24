import React from "react";

import { cn } from "./cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl bg-brand-black border border-brand-border px-4 text-white " +
          "placeholder:text-brand-text2 focus:outline-none focus:ring-2 focus:ring-brand-red/40",
        className,
      )}
      {...props}
    />
  );
}

