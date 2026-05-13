import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, CheckCircle2, Clock, PlayCircle, XCircle } from "lucide-react";
import { CertificateUpload } from "@/components/training/certificate-upload";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  Completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", icon: CheckCircle2 },
  "In Progress": { label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400", icon: PlayCircle },
  Enrolled: { label: "Enrolled", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400", icon: Clock },
  Dropped: { label: "Dropped", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400", icon: XCircle },
};

type EmployeeCourseRow = {
  id: string;
  employee_id: string;
  status: string;
  enrolled_at: string;
  started_at: string | null;
  completed_at: string | null;
  score: number | null;
  certificate_url: string | null;
  notes: string | null;
  courses: {
    title: string;
    develops: string | null;
    link: string | null;
  };
};

export default async function MyCoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("employee_id, full_name, role")
    .eq("id", user.id)
    .single();

  const employeeId = profile?.employee_id;

  // Managers/admins see all employee courses, employees see only their own
  const isEmployee = profile?.role === "employee";

  let query = supabase
    .from("employee_courses")
    .select("id, employee_id, status, enrolled_at, started_at, completed_at, score, certificate_url, notes, courses(title, develops, link)")
    .order("enrolled_at", { ascending: false });

  if (isEmployee && employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data: rows } = await query;
  const courses = (rows ?? []) as unknown as EmployeeCourseRow[];

  const completed = courses.filter((c) => c.status === "Completed").length;
  const inProgress = courses.filter((c) => c.status === "In Progress").length;
  const enrolled = courses.filter((c) => c.status === "Enrolled").length;

  return (
    <>
      <PageHeader
        title={isEmployee ? "My Training Courses" : "Employee Training Courses"}
        description={
          isEmployee
            ? `Track your enrolled, in-progress, and completed courses.`
            : "Overview of all employee course enrollments."
        }
      />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard label="Total Courses" value={courses.length} icon={BookOpen} />
        <SummaryCard label="Completed" value={completed} icon={CheckCircle2} tone="green" />
        <SummaryCard label="In Progress" value={inProgress} icon={PlayCircle} tone="blue" />
        <SummaryCard label="Enrolled" value={enrolled} icon={Clock} tone="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold">No courses yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Training courses will appear here once you are enrolled.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Develops</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Certificate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => {
                  const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.Enrolled;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.courses?.link ? (
                          <a href={c.courses.link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {c.courses?.title ?? "—"}
                          </a>
                        ) : (
                          c.courses?.title ?? "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {c.courses?.develops ? (
                          <Badge variant="outline" className="text-xs">
                            {c.courses.develops === "K" ? "Knowledge" :
                             c.courses.develops === "S" ? "Skill" :
                             c.courses.develops === "B" ? "Behaviour" :
                             c.courses.develops === "D" ? "Desire" :
                             c.courses.develops === "A" ? "Attitude" : c.courses.develops}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(c.enrolled_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.started_at ? fmtDate(c.started_at) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.completed_at ? fmtDate(c.completed_at) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {c.score != null ? `${c.score}%` : "—"}
                      </TableCell>
                      <TableCell>
                        {isEmployee ? (
                          <CertificateUpload
                            assignmentId={c.id}
                            employeeId={c.employee_id}
                            initialUrl={c.certificate_url}
                          />
                        ) : (
                          c.certificate_url ? (
                            <a href={c.certificate_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View</a>
                          ) : "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "green" | "blue" | "amber";
}) {
  const colors = {
    neutral: "text-foreground",
    green: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-8 w-8 ${colors}`} />
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={`text-2xl font-semibold ${colors}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
