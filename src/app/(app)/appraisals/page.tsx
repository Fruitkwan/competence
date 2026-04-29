import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { formatDate, priorityColor, statusColor } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AppraisalsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appraisal_full")
    .select(
      "id, employee_id, full_name, job_title, cluster, appraisal_date, current_avg, gap, priority, status, recommended_course, target_completion, overdue"
    )
    .order("appraisal_date", { ascending: false });

  return (
    <>
      <PageHeader
        title="Appraisals"
        description={`${data?.length ?? 0} appraisals.`}
        actions={
          <>
            <a href="/api/export/appraisals" className={buttonVariants({ variant: "outline" })}>
              Export .xlsx
            </a>
            <Link href="/appraisals/new" className={buttonVariants()}>
              New appraisal
            </Link>
          </>
        }
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Cluster</TableHead>
              <TableHead>Avg</TableHead>
              <TableHead>Gap</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Recommended</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((a) => (
              <TableRow key={a.id} className={a.overdue ? "bg-red-50/40 dark:bg-red-900/10" : ""}>
                <TableCell>{formatDate(a.appraisal_date)}</TableCell>
                <TableCell>
                  <Link href={`/appraisals/${a.id}`} className="hover:underline">
                    <div className="font-medium">{a.full_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {a.employee_id} · {a.job_title}
                    </div>
                  </Link>
                </TableCell>
                <TableCell>{a.cluster}</TableCell>
                <TableCell>{Number(a.current_avg).toFixed(2)}</TableCell>
                <TableCell>{Number(a.gap).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={priorityColor[a.priority]}>
                    {a.priority}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[240px] truncate">
                  {a.recommended_course ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColor[a.status]}>
                    {a.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(a.target_completion)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
