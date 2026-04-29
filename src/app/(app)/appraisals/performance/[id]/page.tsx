import { redirect } from "next/navigation";

/** Placeholder — full edit page will load from Supabase once the table is created */
export default function EditPerformanceAppraisalPage() {
  // For now, redirect to new form; once DB table exists this will load existing data
  redirect("/appraisals/performance/new");
}
