export const COMPETENCY_LEVEL_COLORS: Record<string, string> = {
  Gap: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-100 dark:border-red-800",
  Developing:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800",
  Competent:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800",
  Expert:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-800",
};

export function levelBadgeClass(level: string | null | undefined): string {
  return COMPETENCY_LEVEL_COLORS[level ?? "Competent"] ?? COMPETENCY_LEVEL_COLORS.Competent;
}
