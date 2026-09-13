"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateCycleStatus } from "@/lib/actions/cycles";
import { CYCLE_STATUS_LABELS, type CycleStatus } from "@/lib/constants/roles";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

export function CycleAdvanceButton({
  cycleId,
  nextStatus,
}: {
  cycleId: string;
  nextStatus: CycleStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleAdvance() {
    startTransition(async () => {
      const res = await updateCycleStatus(cycleId, nextStatus);
      if (res?.error) toast.error(res.error);
      else toast.success(`Cycle advanced to ${CYCLE_STATUS_LABELS[nextStatus]}`);
    });
  }

  return (
    <Button onClick={handleAdvance} disabled={isPending} className="w-full">
      {isPending ? "Advancing…" : (
        <>
          Advance to {CYCLE_STATUS_LABELS[nextStatus]}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </>
      )}
    </Button>
  );
}
