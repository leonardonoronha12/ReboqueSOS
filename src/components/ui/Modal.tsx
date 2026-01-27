import React from "react";

import { cn } from "./cn";

export function Modal({
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
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className={cn("w-full max-w-lg rounded-2xl border border-brand-border/20 bg-white shadow-soft")}>
          <div className="border-b border-brand-border/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold text-brand-black">{title}</h3>
              <button className="text-brand-text2 hover:text-brand-black" onClick={onClose} type="button">
                ✕
              </button>
            </div>
          </div>
          <div className="p-4">{children}</div>
          {footer ? <div className="border-t border-brand-border/20 p-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
