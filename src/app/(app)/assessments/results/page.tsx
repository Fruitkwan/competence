import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer, loadAssignmentResult } from "@/lib/assessments/results";
import { loadAssessmentTracker } from "@/lib/assessments/tracker";
import { AssessmentTracker } from "@/components/assessments/results-tracker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

const BAND_STYLE: Record<string, string> = {
  Strength: "border-emerald-300 text-emerald-700",
  "Meets standard": "border-blue-300 text-blue-700",
  "Development gap": "border-amber-300 text-amber-700",
  "Material gap": "border-red-300 text-red-700",
};

function band(score: number | null) {
  if (score == null) return null;
  if (score >= 75) return "Strength";
  if (score >= 60) return "Meets standard";
  if (score >= 45) return "Development gap";
  return "Material gap";
}

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
  const [{ data: employees }, { data: templates }] = await Promise.all([
    rows.length
      ? supabase.from("employees").select("employee_id, full_name, job_title").in("employee_id", [...new Set(rows.map((r) => r.employee_id))])
      : { data: [] },
    rows.length
      ? supabase.from("assessment_templates").select("id, kind, name, role_family").in("id", [...new Set(rows.map((r) => r.template_id))])
      : { data: [] },
  ]);
  const empById = new Map((employees ?? []).map((e) => [e.employee_id, e]));
  const tplById = new Map((templates ?? []).map((t) => [t.id, t]));

  const scored = await Promise.all(
    rows.map(async (a) => {
      const result = await loadAssignmentResult(a.id, viewer);
      return { a, result };
    })
  );

  const tracker = viewer.role === "admin" ? await loadAssessmentTracker() : null;

  const resultsCard = (
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Assessment</TableHead>
              <TableHead>Wave</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Index</TableHead>
              <TableHead>Band</TableHead>
              <TableHead className="text-right">Raters</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="text-right">Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scored.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  No assessments assigned yet.
                </TableCell>
              </TableRow>
            )}
            {scored.map(({ a, result }) => {
              const emp = empById.get(a.employee_id);
              const tpl = tplById.get(a.template_id);
              const index = result?.score.index ?? null;
              const b = band(index);
              const flags = (result?.score.warnings ?? []).filter((w) => w.code !== "provisional").length;
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{emp?.full_name ?? a.employee_id}</div>
                    <div className="text-xs text-muted-foreground">{emp?.job_title}</div>
                  </TableCell>
                  <TableCell>
                    {tpl?.role_family ?? tpl?.name}
                    <span className="ml-1 text-xs capitalize text-muted-foreground">({tpl?.kind === "placement" ? "skill" : tpl?.kind})</span>
                  </TableCell>
                  <TableCell>
                    {a.wave ?? "—"}
                    {a.due_date && <div className="text-xs text-muted-foreground">due {formatDate(a.due_date)}</div>}
                  </TableCell>
                  <TableCell>
                    <span className="capitalize">{a.status.replace("_", " ")}</span>
                    {a.results_released && <div className="text-xs text-emerald-600">released</div>}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{index ?? "—"}</TableCell>
                  <TableCell>
                    {b && (
                      <Badge variant="outline" className={BAND_STYLE[b]}>
                        {b}
                      </Badge>
                    )}
                    {result?.score.provisional && index != null && (
                      <div className="text-[10px] text-amber-600">provisional</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {result ? `${result.raters.filter((r) => r.type !== "self" && r.status === "submitted").length}/${result.raters.filter((r) => r.type !== "self").length}` : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">{flags || ""}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/assessments/${a.id}/report`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
  );

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
          </TabsList>
          <TabsContent value="results">{resultsCard}</TabsContent>
          <TabsContent value="tracker">
            <AssessmentTracker data={tracker} />
          </TabsContent>
        </Tabs>
      ) : (
        resultsCard
      )}
    </>
  );
}
