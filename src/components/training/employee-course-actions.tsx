"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateOwnEmployeeCourseStatus } from "@/lib/actions/training";

type CourseStatus = "Enrolled" | "In Progress" | "Completed" | "Dropped";

export function EmployeeCourseActions({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: CourseStatus | string;
}) {
  const [isPending, startTransition] = useTransition();

  function updateStatus(nextStatus: "In Progress" | "Completed") {
    startTransition(async () => {
      const result = await updateOwnEmployeeCourseStatus(assignmentId, nextStatus);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(nextStatus === "Completed" ? "Course marked completed." : "Course started.");
    });
  }

  if (status === "Completed") {
    return <span className="text-xs text-muted-foreground">Done</span>;
  }

  if (status === "Dropped") {
    return <span className="text-xs text-muted-foreground">Unavailable</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "Enrolled" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => updateStatus("In Progress")}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
          Start
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => updateStatus("Completed")}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
        Complete
      </Button>
    </div>
  );
}
