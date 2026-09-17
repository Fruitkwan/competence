import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ComplaintsClient, type ComplaintListRow } from "@/components/complaints/complaints-client";
import { createClient } from "@/lib/supabase/server";
import { normalizeName } from "@/lib/assessments/match";

function samePersonName(left: string | null | undefined, right: string | null | undefined) {
  const a = normalizeName(left ?? "").split(" ").filter(Boolean);
  const b = normalizeName(right ?? "").split(" ").filter(Boolean);
  if (!a.length || !b.length) return false;
  return a.join(" ") === b.join(" ") || (a[0] === b[0] && a.at(-1) === b.at(-1));
}

export default async function ComplaintsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/complaints");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, employee_id, manager_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/dashboard");

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, case_number, reporter_name, subject_name, category, title, priority, status, created_at, updated_at")
    .order("updated_at", { ascending: false });

  const subjects: { employee_id: string; full_name: string; relation: "manager" | "direct_report" }[] = [];
  if (profile.role === "employee" || profile.role === "manager") {
    const { data: activeEmployees } = await supabase
      .from("employees")
      .select("employee_id, full_name, manager_name")
      .eq("active", true)
      .order("full_name");
    const ownEmployee = (activeEmployees ?? []).find((employee) => employee.employee_id === profile.employee_id) ?? null;
    if (ownEmployee?.manager_name) {
      const manager = (activeEmployees ?? []).find((employee) => samePersonName(employee.full_name, ownEmployee.manager_name));
      if (manager) subjects.push({ ...manager, relation: "manager" });
    }
    if (profile.role === "manager" && profile.full_name) {
      const reports = (activeEmployees ?? []).filter((employee) => samePersonName(employee.manager_name, profile.full_name));
      for (const report of reports) {
        if (!subjects.some((subject) => subject.employee_id === report.employee_id)) subjects.push({ ...report, relation: "direct_report" });
      }
    }
  }

  return (
    <>
      <PageHeader
        title={profile.role === "admin" ? "Complaint Cases" : profile.role === "executive" ? "Executive Escalations" : "Complaints"}
        description={profile.role === "admin" ? "Review confidential employee and manager complaints, document follow-up, and escalate when required." : "Raise and track confidential workplace concerns."}
      />
      <ComplaintsClient role={profile.role} subjects={subjects} complaints={(complaints ?? []) as ComplaintListRow[]} />
    </>
  );
}
