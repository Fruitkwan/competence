import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2 } from "lucide-react";
import { EmployeeDialog } from "./employee-dialog";
import { DeleteEmployeeButton } from "./delete-employee-button";

export const metadata = {
  title: "Employee Management",
};

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/"); // Not authorized
  }

  // Fetch employees
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("full_name");

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization's employee directory and profiles.
          </p>
        </div>
        <EmployeeDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Directory ({employees?.length || 0})</CardTitle>
          <CardDescription>
            All employee records currently registered in the hub.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees && employees.length > 0 ? (
                employees.map((emp) => (
                  <TableRow key={emp.employee_id}>
                    <TableCell className="font-medium">{emp.employee_id}</TableCell>
                    <TableCell>
                      <div>{emp.full_name}</div>
                      <div className="text-xs text-muted-foreground">{emp.email}</div>
                    </TableCell>
                    <TableCell>{emp.job_title}</TableCell>
                    <TableCell>{emp.country_code || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={emp.active ? "default" : "secondary"}>
                        {emp.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <EmployeeDialog
                          initialData={{
                            employee_id: emp.employee_id,
                            full_name: emp.full_name,
                            job_title: emp.job_title,
                            email: emp.email ?? "",
                            country_code: emp.country_code ?? "",
                            manager_name: emp.manager_name ?? "",
                            user_id: emp.user_id ?? undefined,
                            active: emp.active ?? true,
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" title="Edit Employee">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DeleteEmployeeButton id={emp.employee_id} name={emp.full_name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No employees found. Add one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
