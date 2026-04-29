"use client";

import { cn } from "@/lib/utils";

const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Sales",
  "Marketing",
  "Finance",
  "HR",
  "Operations",
  "Customer Success",
  "Legal",
  "Design",
  "Data & Analytics",
  "Supply Chain",
  "IT",
  "Strategy",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export { DEPARTMENTS };

interface DeptGridProps {
  selected: Set<string>;
  onToggle: (dept: string) => void;
}

export function DeptGrid({ selected, onToggle }: DeptGridProps) {
  return (
    <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {DEPARTMENTS.map((dept) => {
        const active = selected.has(dept);
        return (
          <button
            type="button"
            key={dept}
            onClick={() => onToggle(dept)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors select-none",
              active
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input"
              )}
            >
              {active && (
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </span>
            {dept}
          </button>
        );
      })}
    </div>
  );
}
