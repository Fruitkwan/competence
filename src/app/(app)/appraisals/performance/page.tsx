import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function PerformanceAppraisalListPage() {
  return (
    <>
      <PageHeader
        title="Performance Appraisals"
        description="Dhofar Global two-way performance appraisal forms (N1 & N2)."
        actions={
          <Link
            href="/appraisals/performance/new"
            className={buttonVariants()}
          >
            New Appraisal
          </Link>
        }
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">No appraisals yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Performance appraisals will appear here once created. Click
            &quot;New Appraisal&quot; to start the Dhofar Global two-way
            assessment process.
          </p>
          <Link
            href="/appraisals/performance/new"
            className={buttonVariants({ className: "mt-4" })}
          >
            Create First Appraisal
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
