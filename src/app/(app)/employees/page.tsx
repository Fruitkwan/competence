import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { priorityColor } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function EmployeesPage() {
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("employees")
    .select("employee_id, full_name, job_title, country_code, manager_name, active")
    .order("employee_id");

  const { data: latest } = await supabase
    .from("appraisal_full")
    .select("employee_id, priority, current_avg, gap, status, appraisal_date");

  const latestByEmp = new Map<string, { priority: string; avg: number; gap: number; status: string; date: string }>();
  (latest ?? []).forEach((r) => {
    const prev = latestByEmp.get(r.employee_id);
    if (!prev || prev.date < r.appraisal_date) {
      latestByEmp.set(r.employee_id, {
        priority: r.priority,
        avg: Number(r.current_avg ?? 0),
        gap: Number(r.gap ?? 0),
        status: r.status,
        date: r.appraisal_date,
      });
    }
  });

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${employees?.length ?? 0} employees across all clusters and countries.`}
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Latest priority</TableHead>
              <TableHead>Gap</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees?.map((e) => {
              const l = latestByEmp.get(e.employee_id);
              return (
                <TableRow key={e.employee_id}>
                  <TableCell className="font-mono text-xs">
                    <Link className="hover:underline" href={`/employees/${e.employee_id}`}>
                      {e.employee_id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={`/employees/${e.employee_id}`}>
                      {e.full_name}
                    </Link>
                  </TableCell>
                  <TableCell>{e.job_title}</TableCell>
                  <TableCell>{e.country_code ?? "—"}</TableCell>
                  <TableCell>{e.manager_name ?? "—"}</TableCell>
                  <TableCell>
                    {l ? (
                      <Badge variant="outline" className={priorityColor[l.priority]}>
                        {l.priority}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{l ? l.gap.toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l ? l.status : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
