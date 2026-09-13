import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CycleForm } from "@/components/cycles/cycle-form";

export default async function NewCyclePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "admin") redirect("/cycles");

  return (
    <>
      <PageHeader
        title="Create Appraisal Cycle"
        description="Set up a new performance appraisal cycle with timelines and deadlines."
      />
      <CycleForm />
    </>
  );
}
