"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAsRead } from "@/lib/actions/notifications";
import { Check } from "lucide-react";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      disabled={isPending}
      onClick={() => startTransition(async () => { await markAsRead(notificationId); })}
    >
      <Check className="h-3.5 w-3.5" />
    </Button>
  );
}
