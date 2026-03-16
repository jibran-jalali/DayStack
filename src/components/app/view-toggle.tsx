"use client";

import { LayoutGrid, List } from "lucide-react";

import { cn } from "@/lib/utils";

export type PlannerViewMode = "grid" | "list";

interface ViewToggleProps {
  value: PlannerViewMode;
  onChange: (value: PlannerViewMode) => void;
}

const options: Array<{
  value: PlannerViewMode;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="relative inline-grid grid-cols-2 rounded-full border border-border/80 bg-white/90 p-1 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
      <span
        className={cn(
          "pointer-events-none absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-brand-gradient shadow-[0_14px_28px_rgba(23,102,214,0.2)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          value === "grid" ? "translate-x-0" : "translate-x-[calc(100%+0.25rem)]",
        )}
      />
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            suppressHydrationWarning
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 inline-flex h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-[transform,color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] active:scale-[0.985]",
              isActive ? "text-white" : "text-secondary-foreground hover:text-foreground",
            )}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
