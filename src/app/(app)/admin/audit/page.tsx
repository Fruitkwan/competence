import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AuditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  if (profile?.role !== "admin") notFound();

  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, at, actor_email, table_name, row_pk, action")
    .order("at", { ascending: false })
    .limit(500);

  const actionColor: Record<string, string> = {
    INSERT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100",
    UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100",
    DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100",
  };

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Last 500 tracked changes (admin only)."
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Row</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatDate(r.at)}{" "}
                  <span className="text-muted-foreground">
                    {new Date(r.at).toLocaleTimeString("en-GB")}
                  </span>
                </TableCell>
                <TableCell className="text-xs">{r.actor_email ?? "system"}</TableCell>
                <TableCell className="font-mono text-xs">{r.table_name}</TableCell>
                <TableCell className="font-mono text-xs">{r.row_pk ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={actionColor[r.action]}>
                    {r.action}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
