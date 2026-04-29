"use client";

import { cn } from "@/lib/utils";
import type { RatingValue } from "@/lib/supabase/performance-appraisal-types";
import { RATING_LABELS } from "@/lib/supabase/performance-appraisal-types";

interface RatingSelectProps {
  value: RatingValue;
  onChange: (v: RatingValue) => void;
  disabled?: boolean;
  compact?: boolean;
}

const RATING_COLORS: Record<number, string> = {
  5: "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  4: "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  3: "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  2: "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  1: "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export function RatingSelect({ value, onChange, disabled, compact }: RatingSelectProps) {
  return (
    <div className={cn("flex gap-1", compact ? "flex-wrap" : "flex-wrap gap-1.5")}>
      {([5, 4, 3, 2, 1] as const).map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(active ? null : n)}
            title={RATING_LABELS[n]}
            className={cn(
              "rounded-md border text-center font-semibold transition-all select-none",
              compact ? "h-7 w-7 text-xs" : "h-8 min-w-[2rem] px-2 text-sm",
              active
                ? RATING_COLORS[n]
                : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

/** Tiny inline badge showing a rating value with color */
export function RatingBadge({ value }: { value: RatingValue }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold",
        RATING_COLORS[value]
      )}
    >
      {value}
    </span>
  );
}

/** Rating scale reference card */
export function RatingScaleReference() {
  return (
    <div className="rounded-lg border border-border bg-accent/30 p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Performance Rating Scale
      </div>
      <div className="grid gap-1.5">
        {([5, 4, 3, 2, 1] as const).map((n) => (
          <div key={n} className="flex items-start gap-3 text-sm">
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
                RATING_COLORS[n]
              )}
            >
              {n}
            </span>
            <div>
              <span className="font-medium">{RATING_LABELS[n]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
