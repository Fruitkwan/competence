import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { UserMenu } from "@/components/user-menu";

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
    .select("email, full_name, role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "employee";

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r bg-card md:block">
        <AppNav role={role} />
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-3 border-b bg-background/95 px-4 backdrop-blur">
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
