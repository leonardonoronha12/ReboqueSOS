import React from "react";

import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/50 disabled:cursor-not-allowed disabled:opacity-60";

  const variants: Record<Variant, string> = {
    primary: "bg-brand-red text-white hover:brightness-110 shadow-soft",
    secondary: "bg-brand-yellow text-brand-black hover:brightness-110 shadow-soft",
    ghost: "bg-transparent text-white hover:bg-white/10",
    outline: "bg-transparent border border-brand-border text-white hover:bg-white/10",
    danger: "bg-brand-red text-white hover:brightness-110 shadow-glowRed",
  };

  const sizes: Record<Size, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };

  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

