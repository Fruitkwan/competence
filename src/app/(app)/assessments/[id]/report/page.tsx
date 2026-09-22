import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ASSESSMENT_PURPOSE } from "@/lib/assessments/copy";
import { getViewer, loadEmployeeReport } from "@/lib/assessments/results";
import { loadPlacementReport } from "@/lib/assessments/placement";
import { AssessmentReport } from "@/components/assessments/assessment-report";
import { PlacementReportView } from "@/components/assessments/placement-report";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function AssessmentReportPage(props: PageProps<"/assessments/[id]/report">) {
  const { id } = await props.params;
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  // Placement instruments follow a different scoring path; check the kind first.
  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assessment_assignments")
    .select("template_id")
    .eq("id", id)
    .maybeSingle();
  if (!assignment) notFound();
  const { data: template } = await supabase
    .from("assessment_templates")
    .select("kind")
    .eq("id", assignment.template_id)
    .maybeSingle();

  if (template?.kind === "placement") {
    const placement = await loadPlacementReport(id, viewer);
    if (!placement) notFound();
    return (
      <>
        <PageHeader
          title="Skill assessment report"
          description="Outcome decided by the published scoring thresholds, the conduct gate and the verified performance record."
          actions={
            <Link href={viewer.role === "employee" ? "/assessments" : "/assessments/results"} className={buttonVariants({ variant: "outline" })}>
              Back
            </Link>
          }
        />
        <PlacementReportView report={placement} />
      </>
    );
  }

  const report = await loadEmployeeReport(id, viewer);
  if (!report) notFound();

  return (
    <>
      <PageHeader
        title="Assessment report"
        description={ASSESSMENT_PURPOSE}
        actions={
          <Link href={viewer.role === "employee" ? "/assessments" : "/assessments/results"} className={buttonVariants({ variant: "outline" })}>
            Back
          </Link>
        }
      />
      <AssessmentReport report={report} />
    </>
  );
}
