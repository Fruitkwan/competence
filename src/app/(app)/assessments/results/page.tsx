import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer, loadAssignmentResult } from "@/lib/assessments/results";
import { loadAssessmentTracker } from "@/lib/assessments/tracker";
import { AssessmentTracker } from "@/components/assessments/results-tracker";
import { ResultsAnalytics, type AnalyticsRow } from "@/components/assessments/results-analytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ResultsList, type ResultListRow } from "@/components/assessments/results-list";

export default async function AssessmentResultsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "employee") redirect("/assessments");

  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from("assessment_assignments")
    .select("id, template_id, employee_id, wave, due_date, status, results_released, submitted_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = assignments ?? [];
  const [{ data: employees }, { data: templates }, { data: assignmentRaters }] = await Promise.all([
    rows.length
      ? supabase.from("employees").select("employee_id, full_name, job_title, department").in("employee_id", [...new Set(rows.map((r) => r.employee_id))])
      : { data: [] },
    rows.length
      ? supabase.from("assessment_templates").select("id, kind, name, role_family").in("id", [...new Set(rows.map((r) => r.template_id))])
      : { data: [] },
    rows.length
      ? supabase.from("assessment_raters").select("assignment_id, rater_type, status").in("assignment_id", rows.map((r) => r.id))
      : { data: [] },
  ]);
  const empById = new Map((employees ?? []).map((e) => [e.employee_id, e]));
  const tplById = new Map((templates ?? []).map((t) => [t.id, t]));
  const ratersByAssignment = new Map<
    string,
    { assignment_id: string; rater_type: "self" | "line_manager" | "cross_dept" | "peer"; status: "pending" | "submitted" }[]
  >();
  for (const rater of assignmentRaters ?? []) {
    const assignmentRaterRows = ratersByAssignment.get(rater.assignment_id) ?? [];
    assignmentRaterRows.push(rater);
    ratersByAssignment.set(rater.assignment_id, assignmentRaterRows);
  }

  const scored = await Promise.all(
    rows.map(async (a) => {
      const result = await loadAssignmentResult(a.id, viewer);
      return { a, result };
    })
  );

  const tracker = viewer.role === "admin" ? await loadAssessmentTracker() : null;

  const analyticsRows: AnalyticsRow[] = scored.map(({ a, result }) => {
    const emp = empById.get(a.employee_id);
    const tpl = tplById.get(a.template_id);
    const nonSelf = (ratersByAssignment.get(a.id) ?? []).filter((rater) => rater.rater_type !== "self");
    return {
      employeeName: emp?.full_name ?? a.employee_id,
      department: emp?.department ?? "Unknown",
      assessment: tpl?.role_family ?? tpl?.name ?? "",
      kind: tpl?.kind ?? "",
      wave: a.wave,
      status: a.status,
      index: result?.score.index ?? null,
      ratersIn: nonSelf.filter((r) => r.status === "submitted").length,
      ratersTotal: nonSelf.length,
      flags: (result?.score.warnings ?? []).filter((w) => w.code !== "provisional").length,
    };
  });

  const resultRows: ResultListRow[] = scored.map(({ a, result }) => {
    const emp = empById.get(a.employee_id);
    const tpl = tplById.get(a.template_id);
    const raters = ratersByAssignment.get(a.id) ?? [];
    const nonSelf = raters.filter((rater) => rater.rater_type !== "self");
    return {
      id: a.id,
      employeeId: a.employee_id,
      employeeName: emp?.full_name ?? a.employee_id,
      jobTitle: emp?.job_title ?? null,
      department: emp?.department ?? "Unknown",
      assessment: tpl?.role_family ?? tpl?.name ?? "Assessment",
      kind: tpl?.kind ?? "",
      wave: a.wave,
      dueDate: a.due_date,
      assignmentStatus: a.status,
      resultsReleased: a.results_released,
      index: result?.score.index ?? null,
      provisional: result?.score.provisional ?? false,
      selfDone:
        raters.some((rater) => rater.rater_type === "self" && rater.status === "submitted") ||
        a.status === "submitted" ||
        a.status === "closed",
      ratersIn: nonSelf.filter((r) => r.status === "submitted").length,
      ratersTotal: nonSelf.length,
      flags: (result?.score.warnings ?? []).filter((warning) => warning.code !== "provisional").length,
    };
  });

  const resultsCard = <ResultsList rows={resultRows} />;

  return (
    <>
      <PageHeader
        title="Assessment Results"
        description="Scored from self, line manager, cross-departmental / peer and scenario inputs. Open a report for the full profile."
        actions={
          viewer.role !== "executive" ? (
            <Link href="/assessments/assign" className={buttonVariants()}>
              Assign
            </Link>
          ) : null
        }
      />
      {tracker ? (
        <Tabs defaultValue="results">
          <TabsList variant="line" className="mb-4">
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="tracker">Tracker</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="results">{resultsCard}</TabsContent>
          <TabsContent value="tracker">
            <AssessmentTracker data={tracker} />
          </TabsContent>
          <TabsContent value="analytics">
            <ResultsAnalytics rows={analyticsRows} />
          </TabsContent>
        </Tabs>
      ) : (
        resultsCard
      )}
    </>
  );
}
