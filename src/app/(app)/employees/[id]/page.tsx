import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function EmployeePage(props: PageProps<"/employees/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: employee }] = await Promise.all([
    user
      ? supabase.from("profiles").select("role, employee_id, full_name, country_code").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("employees")
      .select("employee_id, full_name, job_title, country_code, manager_name, email, active")
      .eq("employee_id", id)
      .single(),
  ]);
  if (!employee) notFound();

  if (profile?.role === "employee" && profile.employee_id !== employee.employee_id) notFound();
  if (profile?.role === "manager") {
    const { data: managerEmployee } = await supabase
      .from("employees")
      .select("full_name, country_code")
      .eq("employee_id", profile.employee_id)
      .maybeSingle();
    const managerName = managerEmployee?.full_name ?? profile.full_name;
    const managerCountry = canonicalCountry(profile.country_code ?? managerEmployee?.country_code);
    if (
      !sameText(employee.manager_name, managerName) ||
      (managerCountry && canonicalCountry(employee.country_code) !== managerCountry)
    ) {
      notFound();
    }
  }

  const { data: appraisals } = await supabase
    .from("appraisal_full")
    .select("*")
    .eq("employee_id", id)
    .order("appraisal_date", { ascending: false });

  return (
    <>
      <PageHeader
        title={employee.full_name}
        description={`${employee.employee_id} · ${employee.job_title} · ${employee.country_code ?? "—"}`}
        actions={
          <Link
            href={`/appraisals/new?employee=${employee.employee_id}`}
            className={buttonVariants()}
          >
            New appraisal
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row k="ID" v={employee.employee_id} />
            <Row k="Email" v={employee.email ?? "—"} />
            <Row k="Country" v={employee.country_code ?? "—"} />
            <Row k="Manager" v={employee.manager_name ?? "—"} />
            <Row k="Status" v={employee.active ? "Active" : "Inactive"} />
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Latest appraisal</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {appraisals && appraisals.length > 0 ? (
              <LatestBlock a={appraisals[0]} />
            ) : (
              <div className="text-muted-foreground">No appraisals yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Avg</TableHead>
                <TableHead>Gap</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Dominant</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appraisals?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{formatDate(a.appraisal_date)}</TableCell>
                  <TableCell>{Number(a.current_avg).toFixed(2)}</TableCell>
                  <TableCell>{Number(a.gap).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityColor[a.priority]}>
                      {a.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{a.dominant_gap_code}</TableCell>
                  <TableCell>{a.recommended_course ?? "—"}</TableCell>
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
        </CardContent>
      </Card>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function sameText(a: string | null | undefined, b: string | null | undefined) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function canonicalCountry(value: string | null | undefined) {
  const country = value?.trim().toUpperCase();
  return country === "KSA" ? "SA" : country;
}

function LatestBlock({ a }: { a: Record<string, unknown> }) {
  const r = a as {
    appraisal_date: string;
    current_avg: number;
    required_numeric: number;
    gap: number;
    priority: "HIGH" | "MEDIUM" | "LOW";
    knowledge: string;
    skill: string;
    behaviour: string;
    desire: string;
    attitude: string;
    recommended_course: string | null;
    training_mode: string | null;
    status: string;
    target_completion: string | null;
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <Row k="Date" v={formatDate(r.appraisal_date)} />
        <Row k="Current avg" v={Number(r.current_avg).toFixed(2)} />
        <Row k="Required" v={Number(r.required_numeric).toFixed(0)} />
        <Row k="Gap" v={Number(r.gap).toFixed(2)} />
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Priority</span>
          <Badge variant="outline" className={priorityColor[r.priority]}>
            {r.priority}
          </Badge>
        </div>
      </div>
      <div className="space-y-1">
        <Row k="Knowledge" v={r.knowledge} />
        <Row k="Skill" v={r.skill} />
        <Row k="Behaviour" v={r.behaviour} />
        <Row k="Desire" v={r.desire} />
        <Row k="Attitude" v={r.attitude} />
      </div>
      <div className="md:col-span-2 border-t pt-3 space-y-1">
        <Row k="Recommended course" v={r.recommended_course ?? "—"} />
        <Row k="Training mode" v={r.training_mode ?? "—"} />
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Status</span>
          <Badge variant="outline" className={statusColor[r.status]}>
            {r.status}
          </Badge>
        </div>
        <Row k="Target completion" v={formatDate(r.target_completion)} />
      </div>
    </div>
  );
}
