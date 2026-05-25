import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { DepartmentFormSection } from "./department-form-section";
import { DepartmentCard } from "./department-card";
import { Building2 } from "lucide-react";

export default async function AdminDepartmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: departments } = await supabase
    .from("departments")
    .select("*")
    .order("name");

  const { data: profiles } = await supabase.from("profiles").select("department_id");

  const deptCounts = new Map<string, number>();
  profiles?.forEach((p) => {
    if (p.department_id) {
      deptCounts.set(p.department_id, (deptCounts.get(p.department_id) ?? 0) + 1);
    }
  });

  const headIds = departments?.filter((d) => d.head_id).map((d) => d.head_id!) ?? [];
  const { data: heads } =
    headIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", headIds)
      : { data: [] };
  const headMap = new Map(heads?.map((h) => [h.id, h.full_name]) ?? []);

  const departmentRows = (departments ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    headName: d.head_id ? (headMap.get(d.head_id) ?? null) : null,
    memberCount: deptCounts.get(d.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Departments"
        description="Manage organizational departments — add, rename, or remove unused ones."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!departmentRows.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <h3 className="text-lg font-medium">No departments</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first department using the form.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {departmentRows.map((department) => (
                <DepartmentCard key={department.id} department={department} />
              ))}
            </div>
          )}
        </div>

        <DepartmentFormSection />
      </div>
    </>
  );
}
