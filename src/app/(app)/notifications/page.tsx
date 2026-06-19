import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markAllAsRead } from "@/lib/actions/notifications";
import { NOTIFICATION_ICONS } from "@/lib/constants/notification-types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Bell } from "lucide-react";
import { MarkReadButton } from "./mark-read-button";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
        actions={
          unreadCount > 0 ? (
            <form action={async () => { "use server"; await markAllAsRead(); }}>
              <Button variant="outline" size="sm" type="submit">
                Mark all as read
              </Button>
            </form>
          ) : undefined
        }
      />

      {!notifications || notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-lg font-medium">All caught up!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No notifications to show.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={cn(!n.read && "border-l-2 border-l-blue-500")}>
              <CardContent className="flex items-start gap-3 p-4">
                <span className="mt-0.5 text-lg">
                  {NOTIFICATION_ICONS[n.type] ?? "🔔"}
                </span>
                <div className="flex-1">
                  {n.link ? (
                    <Link href={n.link} className="font-medium hover:underline">
                      {n.title}
                    </Link>
                  ) : (
                    <div className="font-medium">{n.title}</div>
                  )}
                  {n.body && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground/60">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                {!n.read && <MarkReadButton notificationId={n.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
