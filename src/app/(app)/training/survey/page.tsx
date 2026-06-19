import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  TrainingSurveyForm,
  type TrainingSurveyInitialProfile,
} from "@/components/training/training-survey-form";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "manager" | "employee" | "executive";
  employee_id: string | null;
  job_title: string | null;
};

type EmployeeRow = {
  employee_id: string;
  full_name: string;
  job_title: string;
  department: string | null;
  email: string | null;
  manager_name: string | null;
};

export default async function TrainingSurveyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/training/survey");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, employee_id, job_title")
    .eq("id", user.id)
    .single<ProfileRow>();

  const employee = await getCurrentEmployee(
    supabase,
    profile?.employee_id ?? null,
    user.id,
    profile?.email ?? user.email ?? null
  );

  const [{ data: departmentRows }, { data: employeeDepartmentRows }] = await Promise.all([
    supabase.from("departments").select("name").order("name", { ascending: true }),
    supabase
      .from("employees")
      .select("department")
      .not("department", "is", null)
      .order("department", { ascending: true }),
  ]);

  const departmentOptions = uniqueSorted([
    ...(departmentRows ?? []).map((row) => row.name),
    ...(employeeDepartmentRows ?? []).map((row) => row.department),
    employee?.department,
  ]);

  const initialProfile: TrainingSurveyInitialProfile = {
    fullName: employee?.full_name ?? profile?.full_name ?? "",
    jobTitle: employee?.job_title ?? profile?.job_title ?? "",
    department: employee?.department ?? "",
    roleLevel: roleToLevel(profile?.role),
    email: employee?.email ?? profile?.email ?? user.email ?? "",
    managerName: employee?.manager_name ?? "",
  };

  return (
    <>
      <PageHeader
        title="Cross-Functional Training Survey"
        description="Help us plan smarter training across teams. This takes 3-5 minutes."
      />
      <TrainingSurveyForm
        departmentOptions={departmentOptions}
        initialProfile={initialProfile}
      />
    </>
  );
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b)
  );
}

function roleToLevel(role?: ProfileRow["role"]) {
  if (role === "manager") return "Manager";
  if (role === "executive") return "VP / Executive";
  return "Employee / Individual Contributor";
}

async function getCurrentEmployee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string | null,
  userId: string,
  email: string | null
) {
  const select = "employee_id, full_name, job_title, department, email, manager_name";

  if (employeeId) {
    const { data } = await supabase
      .from("employees")
      .select(select)
      .eq("employee_id", employeeId)
      .maybeSingle<EmployeeRow>();
    if (data) return data;
  }

  const { data: byUserId } = await supabase
    .from("employees")
    .select(select)
    .eq("user_id", userId)
    .maybeSingle<EmployeeRow>();
  if (byUserId) return byUserId;

  if (email) {
    const { data } = await supabase
      .from("employees")
      .select(select)
      .ilike("email", email)
      .maybeSingle<EmployeeRow>();
    if (data) return data;
  }

  return null;
}
