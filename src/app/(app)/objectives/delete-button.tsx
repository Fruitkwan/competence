"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteObjective } from "@/lib/actions/objectives";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function DeleteObjectiveButton({ objectiveId }: { objectiveId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this objective?")) return;
    startTransition(async () => {
      const res = await deleteObjective(objectiveId);
      if (res?.error) toast.error(res.error);
      else toast.success("Objective deleted");
    });
  }

  return (
    <Button size="icon" variant="ghost" onClick={handleDelete} disabled={isPending} className="h-7 w-7 text-muted-foreground hover:text-destructive">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
