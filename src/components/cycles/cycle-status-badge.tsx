import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CYCLE_STATUS_LABELS, type CycleStatus } from "@/lib/constants/roles";

const statusStyles: Record<CycleStatus, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  objective_setting: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  assessment: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  calibration: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  review: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

export function CycleStatusBadge({
  status,
  className,
}: {
  status: CycleStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border-0 font-medium", statusStyles[status], className)}
    >
      {CYCLE_STATUS_LABELS[status]}
    </Badge>
  );
}
