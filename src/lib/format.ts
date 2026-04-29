export const priorityColor: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-100 dark:border-red-800",
  MEDIUM:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800",
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800",
};

export const statusColor: Record<string, string> = {
  "Not Started": "bg-muted text-muted-foreground border",
  "In Progress":
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100",
  Completed:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100",
  Cancelled: "bg-muted text-muted-foreground border",
  Blocked:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-100",
};

export function formatPct(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}
