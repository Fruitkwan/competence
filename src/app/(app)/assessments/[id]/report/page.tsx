import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer, loadEmployeeReport } from "@/lib/assessments/results";
import { AssessmentReport } from "@/components/assessments/assessment-report";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

export default async function AssessmentReportPage(props: PageProps<"/assessments/[id]/report">) {
  const { id } = await props.params;
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const report = await loadEmployeeReport(id, viewer);
  if (!report) notFound();

  return (
    <>
      <PageHeader
        title="Assessment report"
        description="Training-needs diagnostic. Not the formal performance appraisal; not used for title, promotion or disciplinary decisions."
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
