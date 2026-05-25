"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAsRead, markAllAsRead } from "@/lib/actions/notifications";
import { NOTIFICATION_ICONS } from "@/lib/constants/notification-types";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [count, setCount] = useState(unreadCount);
  const [items, setItems] = useState(notifications);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCount(unreadCount);
    setItems(notifications);
  }, [unreadCount, notifications]);

  function handleClick(n: Notification) {
    if (!n.read) {
      startTransition(async () => {
        await markAsRead(n.id);
      });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setCount((c) => Math.max(0, c - 1));
    }
    if (n.link) {
      router.push(n.link);
    }
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllAsRead();
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setCount(0);
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />
        }
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            {count > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                {count} unread
              </span>
            )}
          </DropdownMenuLabel>
          {count > 0 && (
            <DropdownMenuItem
              disabled={isPending}
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground"
            >
              Mark all read
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <>
            <DropdownMenuGroup>
              {items.slice(0, 8).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(!n.read && "bg-accent/30")}
                  onClick={() => handleClick(n)}
                >
                  <span className="mt-0.5 shrink-0 text-base leading-none">
                    {NOTIFICATION_ICONS[n.type] ?? "🔔"}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="truncate text-sm font-medium leading-tight">{n.title}</div>
                    {n.body && (
                      <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground/60">
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  {!n.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/notifications" className="w-full" />}>
              <span className="flex w-full justify-center text-xs font-medium text-muted-foreground">
                View all notifications
              </span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
