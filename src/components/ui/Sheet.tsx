import React from "react";

import { cn } from "./cn";

export function Sheet({
  open,
  title,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className={cn("flex w-full max-w-lg flex-col rounded-2xl bg-white border border-brand-border/20 shadow-soft max-h-[85dvh]")}>
          <div className="shrink-0 p-4 border-b border-brand-border/20">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold tracking-tight text-brand-black">{title}</h3>
              <button className="text-brand-text2 hover:text-brand-black" onClick={onClose} type="button">
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer ? <div className="shrink-0 p-4 border-t border-brand-border/20">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
