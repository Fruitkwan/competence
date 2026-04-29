"use client";

import { cn } from "@/lib/utils";

interface PillSelectProps {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
}

export function PillSelect({ options, value, onChange }: PillSelectProps) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-full border px-4 py-2 text-[13px] transition-colors select-none",
            value === opt
              ? "border-primary bg-primary/10 font-medium text-primary"
              : "border-border text-muted-foreground hover:border-primary/40"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
