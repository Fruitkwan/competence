import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export default async function CoursesPage() {
  const supabase = await createClient();
  const [{ data: courses }, { data: rules }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, develops, cluster_fit, link, active")
      .eq("active", true)
      .order("title"),
    supabase
      .from("course_rules")
      .select("cluster, gap_code, training_mode, course_id"),
  ]);

  const assignedCount = new Map<string, number>();
  (rules ?? []).forEach((r) => {
    assignedCount.set(r.course_id, (assignedCount.get(r.course_id) ?? 0) + 1);
  });

  return (
    <>
      <PageHeader
        title="Courses"
        description="Nammy.me course directory and how they map to gap codes."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Course Directory</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Develops</TableHead>
                <TableHead>Clusters</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead>Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell className="text-muted-foreground">{c.develops}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.cluster_fit.map((cf) => (
                        <Badge key={cf} variant="secondary">
                          {cf}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{assignedCount.get(c.id) ?? 0}</TableCell>
                  <TableCell>
                    {c.link ? (
                      <Link
                        href={c.link}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        open <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course Rules — Cluster × Gap</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cluster</TableHead>
                <TableHead>Gap code</TableHead>
                <TableHead>Recommended course</TableHead>
                <TableHead>Mode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules?.map((r) => {
                const title = courses?.find((c) => c.id === r.course_id)?.title ?? "—";
                return (
                  <TableRow key={`${r.cluster}-${r.gap_code}`}>
                    <TableCell>{r.cluster}</TableCell>
                    <TableCell className="font-mono text-xs">{r.gap_code}</TableCell>
                    <TableCell className="font-medium">{title}</TableCell>
                    <TableCell>{r.training_mode}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
