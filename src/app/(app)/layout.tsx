import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (profile && profile.is_active === false) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-lg font-semibold">Account deactivated</h1>
          <p className="text-sm text-muted-foreground">
            Your account has been deactivated. Contact HR if you believe this is a mistake.
          </p>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm font-medium text-primary underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  const role = profile?.role ?? "employee";

  // Fetch notifications for bell
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r bg-card md:block">
        <AppNav role={role} />
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <NotificationBell
            notifications={notifications ?? []}
            unreadCount={unreadCount ?? 0}
          />
          <UserMenu
            email={profile?.email ?? user.email ?? ""}
            fullName={profile?.full_name ?? null}
            role={role}
          />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

