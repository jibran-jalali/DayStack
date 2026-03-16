"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";

interface TaskModalProps {
  children: ReactNode;
  description: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function TaskModal({ children, description, onClose, open, title }: TaskModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      <button
        suppressHydrationWarning
        type="button"
        aria-label="Close task modal"
        className="absolute inset-0 bg-slate-950/24 backdrop-blur-[4px] transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[85vh] w-full max-w-2xl items-end px-0 sm:inset-0 sm:items-center sm:px-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "relative w-full overflow-hidden rounded-t-[28px] border border-white/70 bg-white/96 shadow-[0_30px_90px_rgba(15,23,42,0.18)] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] sm:rounded-[28px]",
            open ? "translate-y-0 opacity-100 sm:scale-100" : "translate-y-5 opacity-95 sm:scale-[0.985]",
          )}
        >
          <div className="border-b border-border/80 px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Task editor</p>
                <h2 className="mt-1 font-display text-[1.75rem] font-semibold text-foreground">{title}</h2>
                <p className="mt-1.5 text-sm text-secondary-foreground">{description}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-9 w-9 rounded-full px-0" onClick={onClose} aria-label="Close task modal">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[calc(85vh-5.5rem)] overflow-y-auto px-5 py-5 soft-scrollbar sm:px-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
