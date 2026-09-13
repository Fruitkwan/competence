import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { TrainingRequestForm } from "@/components/training/training-request-form";
import { createClient } from "@/lib/supabase/server";

export default async function TrainingRequestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/training/request");

  const [{ data: profile }, { data: courses }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("courses")
      .select("id, title, develops")
      .eq("active", true)
      .order("title", { ascending: true }),
  ]);

  if (profile?.role !== "employee") redirect("/training/dashboard");

  return (
    <>
      <PageHeader
        title="Training Request"
        description="Ask your manager to approve a specific course from the catalog."
      />
      <TrainingRequestForm courses={courses ?? []} />
    </>
  );
}
