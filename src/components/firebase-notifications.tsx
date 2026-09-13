"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerFirebaseMessagingToken } from "@/lib/actions/notifications";
import { requestFirebaseMessagingToken, subscribeToForegroundMessages } from "@/lib/firebase/client";

type PermissionState = "unsupported" | "default" | "denied" | "granted";

export function FirebaseNotifications() {
  const [permission, setPermission] = useState<PermissionState>(() => currentPermission());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      return;
    }

    let unsubscribe: (() => void) | undefined;
    subscribeToForegroundMessages((message) => {
      toast(message.title, {
        description: message.body,
        action: message.link
          ? {
              label: "Open",
              onClick: () => {
                window.location.href = message.link!;
              },
            }
          : undefined,
      });
    }).then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  if (permission !== "default") return null;

  function enableNotifications() {
    startTransition(async () => {
      const result = await requestFirebaseMessagingToken();
      if ("error" in result) {
        toast.error(result.error);
        if (typeof window !== "undefined" && "Notification" in window) {
          setPermission(Notification.permission as PermissionState);
        }
        return;
      }

      const saveResult = await registerFirebaseMessagingToken(result.token, navigator.userAgent);
      if ("error" in saveResult) {
        toast.error(saveResult.error);
        return;
      }

      setPermission("granted");
      toast.success("Push notifications enabled.");
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      onClick={enableNotifications}
      disabled={isPending}
      aria-label="Enable push notifications"
      title="Enable push notifications"
    >
      <BellRing className="h-4 w-4" />
    </Button>
  );
}

function currentPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }

  return Notification.permission as PermissionState;
}
