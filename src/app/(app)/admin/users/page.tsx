import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { UsersTable, type UserManagementRow } from "./users-table";

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
    .select("id, email, full_name, role, employee_id, job_title, country_code, is_active, department_id, manager_id, created_at")
    .order("full_name", { ascending: true });

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name");
  const employeeIds = users?.map((u) => u.employee_id).filter((id): id is string => Boolean(id)) ?? [];
  const { data: employees } = employeeIds.length
    ? await supabase
        .from("employees")
        .select("employee_id, job_title, department, country_code, manager_name")
        .in("employee_id", employeeIds)
    : { data: [] };
  const deptMap = new Map(departments?.map((d) => [d.id, d.name]) ?? []);
  const nameMap = new Map(users?.map((u) => [u.id, u.full_name]) ?? []);
  const employeeMap = new Map(employees?.map((e) => [e.employee_id, e]) ?? []);

  const userRows: UserManagementRow[] = (users ?? []).map((profileRow) => {
    const employee = profileRow.employee_id ? employeeMap.get(profileRow.employee_id) : null;
    const managerName = profileRow.manager_id ? nameMap.get(profileRow.manager_id) : employee?.manager_name;
    return {
      ...profileRow,
      display_job_title: profileRow.job_title ?? employee?.job_title ?? null,
      display_department: profileRow.department_id ? deptMap.get(profileRow.department_id) ?? null : employee?.department ?? null,
      display_country: profileRow.country_code ?? employee?.country_code ?? null,
      display_manager: managerName && !samePerson(managerName, profileRow.full_name) ? managerName : null,
    };
  });

  return (
    <>
      <PageHeader
        title="User Management"
        description={`${users?.length ?? 0} users in the system.`}
      />

      <UsersTable
        users={userRows}
        departments={(departments ?? []).map((department) => ({ id: department.id, name: department.name }))}
        managers={(users ?? []).map((manager) => ({ id: manager.id, name: manager.full_name ?? manager.email }))}
        currentUserId={user!.id}
      />
    </>
  );
}

function samePerson(a: string, b: string | null) {
  if (!b) return false;
  const parts = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const left = parts(a);
  const right = parts(b);
  return left[0] === right[0] && left.at(-1) === right.at(-1);
}
