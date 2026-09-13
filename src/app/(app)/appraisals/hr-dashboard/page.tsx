import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { CheckCircle2, ClipboardCheck, AlertCircle, BarChart } from "lucide-react";
import { HRDashboardCharts } from "./hr-dashboard-charts";
import { RATING_LABELS } from "@/lib/supabase/performance-appraisal-types";

type DashboardAppraisal = {
  id: string;
  employee_id: string;
  appraisal_type: string | null;
  status: string;
  calibrated_rating: number | null;
  final_rating: number | null;
  total_weighted_score: number | null;
  employee_signed_at: string | null;
  manager_signed_at: string | null;
  hr_signed_at: string | null;
  created_at: string;
  employees?: {
    full_name?: string | null;
    department?: string | null;
  } | null;
};

export default async function HRDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch all appraisals for the dashboard
  const { data: appraisalsRaw } = await supabase
    .from("performance_appraisals")
    .select(`
      id,
      employee_id,
      appraisal_type,
      status,
      calibrated_rating,
      final_rating,
      total_weighted_score,
      employee_signed_at,
      manager_signed_at,
      hr_signed_at,
      created_at,
      employees!performance_appraisals_employee_id_fkey (full_name, department)
    `)
    .order("created_at", { ascending: false });
  const appraisals = (appraisalsRaw ?? []) as unknown as DashboardAppraisal[];

  const totalAppraisals = appraisals.length;
  const pendingCalibration = appraisals.filter((a) => a.employee_signed_at && a.manager_signed_at && !a.hr_signed_at);
  const finalAppraisals = appraisals.filter((a) => a.status === "Final");
  const inProgress = appraisals.filter((a) => a.status === "Draft" || a.status === "N1 Complete");

  // Data for charts
  const statusData = [
    { name: "In Progress", value: inProgress.length },
    { name: "Pending HR", value: pendingCalibration.length },
    { name: "Finalized", value: finalAppraisals.length }
  ];

  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  finalAppraisals.forEach((a) => {
    const rating = a.calibrated_rating || a.final_rating;
    if (rating && rating >= 1 && rating <= 5) {
      ratingCounts[rating as 1|2|3|4|5]++;
    }
  });

  const ratingData = Object.entries(ratingCounts).map(([rating, count]) => ({
    name: `${rating} - ${RATING_LABELS[Number(rating) as 1|2|3|4|5]}`,
    value: count
  }));

  return (
    <div className="space-y-6">
      <PageHeader 
        title="HR Dashboard" 
        description="Monitor appraisal completion, calibrate ratings, and finalize performance reviews."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Appraisals</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAppraisals}</div>
            <p className="text-xs text-muted-foreground">across all cycles</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Calibration</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCalibration.length}</div>
            <p className="text-xs text-muted-foreground">ready for HR review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalized</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finalAppraisals.length}</div>
            <p className="text-xs text-muted-foreground">completed & signed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <BarChart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgress.length}</div>
            <p className="text-xs text-muted-foreground">N1 or Draft status</p>
          </CardContent>
        </Card>
      </div>

      <HRDashboardCharts statusData={statusData} ratingData={ratingData} />

      <Card>
        <CardHeader>
          <CardTitle>Action Required: Pending HR Calibration</CardTitle>
          <CardDescription>These appraisals have been completed by the manager and require HR sign-off.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingCalibration.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500/50" />
              <p className="text-sm text-muted-foreground">All caught up! No appraisals pending calibration.</p>
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Employee</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Department</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Type</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Score</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {pendingCalibration.map((appraisal) => {
                    const empName = appraisal.employees?.full_name || appraisal.employee_id;
                    const dept = appraisal.employees?.department || "—";
                    
                    return (
                      <tr key={appraisal.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle font-medium">{empName}</td>
                        <td className="p-4 align-middle text-muted-foreground">{dept}</td>
                        <td className="p-4 align-middle"><Badge variant="outline">{appraisal.appraisal_type}</Badge></td>
                        <td className="p-4 align-middle">{appraisal.total_weighted_score?.toFixed(1) || "—"}</td>
                        <td className="p-4 align-middle text-right">
                          <Link href={`/appraisals/performance/${appraisal.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            Review & Sign
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
