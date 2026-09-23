import { notFound } from "next/navigation";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecycleBinActions } from "./recycle-bin-actions";
import type { RecyclableTable } from "@/lib/actions/recycle-bin";

const TYPE_LABELS: Record<RecyclableTable, string> = {
  employees: "Employee",
  assessment_assignments: "Assessment assignment",
  assessment_templates: "Assessment template",
  cycle_objectives: "Objective",
  employee_courses: "Course assignment",
  departments: "Department",
  role_kpi_templates: "Role KPI",
  role_competencies: "Role competency",
};

export default async function RecycleBinPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") notFound();

  const { data, error } = await supabase.rpc("list_recycle_bin");
  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title="Recycle Bin"
        description="Restore records removed by an administrator or permanently delete them when they are no longer needed."
      />

      {error ? (
        <Card className="border-red-200 p-4 text-sm text-red-700">
          Recycle Bin could not be loaded: {error.message}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="rounded-full bg-muted p-3"><Trash2 className="size-6 text-muted-foreground" /></div>
          <div>
            <div className="font-medium">Recycle Bin is empty</div>
            <div className="mt-1 text-sm text-muted-foreground">Removed records will appear here and can be restored.</div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArchiveRestore className="size-4" /> {rows.length} recoverable {rows.length === 1 ? "record" : "records"}
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Removed</TableHead>
                  <TableHead>Removed by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.table_name}-${row.record_id}`}>
                    <TableCell>
                      <div className="font-medium">{row.label}</div>
                      <div className="text-xs text-muted-foreground">{row.detail}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TYPE_LABELS[row.table_name as RecyclableTable] ?? row.table_name}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(row.deleted_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.deleted_by_email ?? "System"}</TableCell>
                    <TableCell className="text-right">
                      <RecycleBinActions
                        table={row.table_name as RecyclableTable}
                        recordId={row.record_id}
                        label={row.label}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
