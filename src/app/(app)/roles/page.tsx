import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function RolesPage() {
  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("roles")
    .select("title, cluster, kpi_linked, required_level, notes")
    .eq("active", true)
    .order("cluster")
    .order("title");

  return (
    <>
      <PageHeader
        title="Role Benchmark"
        description="Required competency level per role, grouped by cluster."
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role / Job Title</TableHead>
              <TableHead>Cluster</TableHead>
              <TableHead>KPI Linked</TableHead>
              <TableHead>Required Level</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles?.map((r) => (
              <TableRow key={r.title}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{r.cluster}</TableCell>
                <TableCell className="text-muted-foreground">{r.kpi_linked}</TableCell>
                <TableCell>{r.required_level}</TableCell>
                <TableCell className="text-muted-foreground">{r.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
