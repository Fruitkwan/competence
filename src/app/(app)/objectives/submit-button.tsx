"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { submitObjectives } from "@/lib/actions/objectives";
import { toast } from "sonner";
import { Send } from "lucide-react";

export function SubmitObjectivesButton({ cycleId }: { cycleId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitObjectives(cycleId);
      if (res?.error) toast.error(res.error);
      else toast.success("Objectives submitted for manager review");
    });
  }

  return (
    <Button onClick={handleSubmit} disabled={isPending} className="gap-1.5">
      <Send className="h-3.5 w-3.5" />
      {isPending ? "Submitting…" : "Submit All for Review"}
    </Button>
  );
}
