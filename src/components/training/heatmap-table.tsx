"use client";

import { cn } from "@/lib/utils";

interface HeatmapData {
  departments: string[];
  /** rows[i][j] = demand count. Diagonal (i===j) is shown as "—" */
  rows: (number | null)[][];
}

const HEAT_CLASSES: Record<string, string> = {
  h0: "bg-muted text-muted-foreground/40",
  h1: "bg-muted-foreground/20 text-muted-foreground",
  h2: "bg-primary/30 text-primary",
  h3: "bg-primary/60 text-primary-foreground",
  h4: "bg-primary text-primary-foreground",
};

function heatLevel(v: number): string {
  if (v <= 0) return "h0";
  if (v <= 2) return "h1";
  if (v <= 4) return "h2";
  if (v <= 6) return "h3";
  return "h4";
}

export function HeatmapTable({ departments, rows }: HeatmapData) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[560px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
              Wants to learn ↓ / From →
            </th>
            {departments.map((d) => (
              <th
                key={d}
                className="px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground"
              >
                {d.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {departments.map((dept, i) => (
            <tr key={dept}>
              <td className="whitespace-nowrap px-3 py-1.5 text-left text-[13px] font-medium text-foreground">
                {dept}
              </td>
              {rows[i].map((val, j) => {
                const isDiag = i === j;
                const level = isDiag ? "h0" : heatLevel(val ?? 0);
                return (
                  <td key={j} className="px-1 py-1">
                    <div
                      className={cn(
                        "mx-auto flex h-8 w-10 items-center justify-center rounded-md text-xs font-semibold",
                        HEAT_CLASSES[level]
                      )}
                    >
                      {isDiag ? "—" : val}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>Demand:</span>
        {[
          { label: "0", cls: "bg-muted border border-border" },
          { label: "1–2", cls: "bg-muted-foreground/20" },
          { label: "3–4", cls: "bg-primary/30" },
          { label: "5–6", cls: "bg-primary/60" },
          { label: "7+", cls: "bg-primary" },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("inline-block h-3.5 w-3.5 rounded-sm", cls)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
