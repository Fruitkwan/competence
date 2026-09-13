import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ObjectiveReviewCard } from "@/components/objectives/objective-review-card";
import { redirect } from "next/navigation";

export default async function ReviewObjectivesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const role = profile?.role ?? "employee";
  if (role !== "manager" && role !== "admin") redirect("/dashboard");

  // Get all team members (or all employees for admin)
  let teamFilter;
  if (role === "manager") {
    teamFilter = supabase
      .from("profiles")
      .select("id")
      .eq("manager_id", user!.id);
  } else {
    teamFilter = supabase
      .from("profiles")
      .select("id");
  }
  const { data: teamMembers } = await teamFilter;
  const teamIds = teamMembers?.map((t) => t.id) ?? [];

  if (teamIds.length === 0) {
    return (
      <>
        <PageHeader title="Review Objectives" description="Review and approve employee objectives." />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No team members found.
          </CardContent>
        </Card>
      </>
    );
  }

  // Get submitted objectives from team members
  type ReviewObjectiveRow = {
    id: string;
    title: string;
    description: string | null;
    success_criteria: string | null;
    weight: number;
    status: string;
    cycle_id: string;
    employee_id: string;
    objective_comments?: { id: string; body: string; created_at: string; author_id: string }[];
  };

  const { data: rawObjectives } = await supabase
    .from("cycle_objectives")
    .select("id, title, description, success_criteria, weight, status, cycle_id, employee_id")
    .in("employee_id", teamIds)
    .in("status", ["submitted", "revision_requested"])
    .order("updated_at", { ascending: false });

  const objectives = (rawObjectives ?? []) as ReviewObjectiveRow[];

  // Fetch comments separately
  if (objectives.length > 0) {
    const objIds = objectives.map((o) => o.id);
    const { data: comments } = await supabase
      .from("objective_comments")
      .select("id, body, created_at, author_id, objective_id")
      .in("objective_id", objIds);
    if (comments) {
      for (const o of objectives) {
        o.objective_comments = comments.filter(
          (c) => (c as unknown as { objective_id: string }).objective_id === o.id
        );
      }
    }
  }

  // Get employee names
  const empIds = [...new Set(objectives.map((o) => o.employee_id))];
  const { data: employees } = empIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", empIds)
    : { data: [] };

  const nameMap = new Map(employees?.map((e) => [e.id, e.full_name]) ?? []);

  // Group by employee
  const grouped = new Map<string, ReviewObjectiveRow[]>();
  objectives.forEach((o) => {
    const list = grouped.get(o.employee_id) ?? [];
    list.push(o);
    grouped.set(o.employee_id, list);
  });

  return (
    <>
      <PageHeader
        title="Review Objectives"
        description={`${objectives?.length ?? 0} objectives pending your review.`}
      />

      {!objectives || objectives.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No objectives pending review. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([empId, objs]) => (
            <div key={empId}>
              <h3 className="mb-3 text-lg font-semibold">
                {nameMap.get(empId) ?? "Unknown Employee"}
              </h3>
              <div className="space-y-3">
                {objs!.map((o) => {
                  // Build comment list with author names
                  const comments = (o.objective_comments ?? []).map((c: { id: string; body: string; created_at: string; author_id: string }) => ({
                    id: c.id,
                    body: c.body,
                    created_at: c.created_at,
                    author_name: nameMap.get(c.author_id) ?? null,
                  }));
                  return (
                    <ObjectiveReviewCard
                      key={o.id}
                      objective={{
                        id: o.id,
                        title: o.title,
                        description: o.description,
                        success_criteria: o.success_criteria,
                        weight: o.weight,
                        status: o.status as "submitted" | "revision_requested",
                        comments,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
