import React from "react";

import { cn } from "./cn";

type BadgeVariant = "pending" | "proposal" | "accepted" | "enroute" | "arrived" | "service" | "done" | "paid";

const map: Record<BadgeVariant, string> = {
  pending: "bg-white/10 text-white border border-brand-border",
  proposal: "bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30",
  accepted: "bg-brand-info/15 text-brand-info border border-brand-info/30",
  enroute: "bg-brand-info/15 text-brand-info border border-brand-info/30",
  arrived: "bg-white/10 text-white border border-brand-border",
  service: "bg-white/10 text-white border border-brand-border",
  done: "bg-brand-success/15 text-brand-success border border-brand-success/30",
  paid: "bg-brand-success/15 text-brand-success border border-brand-success/30",
};

export function Badge({
  variant = "pending",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", map[variant], className)}>
      {children}
    </span>
  );
}

