import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmployeeImportForm } from "./employee-import-form";

export const metadata = {
  title: "Import Employees",
};

export default async function EmployeeImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="mb-4">
        <Link href="/admin/employees" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to employee management
        </Link>
      </div>
      <PageHeader
        title="Import Employees"
        description="Upload the HR basis workbook to add new employees, update existing records, and optionally deactivate missing employees."
      />
      <EmployeeImportForm />
    </div>
  );
}
