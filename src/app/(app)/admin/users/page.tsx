import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { AppRole } from "@/lib/constants/roles";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, employee_id, is_active, department_id, manager_id, created_at")
    .order("full_name", { ascending: true });

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name");
  const employeeIds = users?.map((u) => u.employee_id).filter((id): id is string => Boolean(id)) ?? [];
  const { data: employees } = employeeIds.length
    ? await supabase
        .from("employees")
        .select("employee_id, department, manager_name")
        .in("employee_id", employeeIds)
    : { data: [] };
  const deptMap = new Map(departments?.map((d) => [d.id, d.name]) ?? []);
  const nameMap = new Map(users?.map((u) => [u.id, u.full_name]) ?? []);
  const employeeMap = new Map(employees?.map((e) => [e.employee_id, e]) ?? []);

  const roleBadgeColor: Record<string, string> = {
    admin: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    manager: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    employee: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    executive: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  };

  return (
    <>
      <PageHeader
        title="User Management"
        description={`${users?.length ?? 0} users in the system.`}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Department</th>
                  <th className="px-4 py-3 text-left font-medium">Manager</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => {
                  const employee = u.employee_id ? employeeMap.get(u.employee_id) : null;
                  return (
                  <tr key={u.id} className="border-b transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {u.full_name ?? "â€”"}
                      {u.employee_id && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          #{u.employee_id}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`border-0 ${roleBadgeColor[u.role] ?? ""}`}
                      >
                        {ROLE_LABELS[u.role as AppRole] ?? u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.department_id ? deptMap.get(u.department_id) ?? "—" : employee?.department ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.manager_id ? nameMap.get(u.manager_id) ?? "—" : employee?.manager_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active !== false ? (
                        <span className="text-emerald-600">Active</span>
                      ) : (
                        <span className="text-muted-foreground">Inactive</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
