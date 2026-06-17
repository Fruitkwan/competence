import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2, Upload } from "lucide-react";
import { EmployeeDialog } from "./employee-dialog";
import { DeleteEmployeeButton } from "./delete-employee-button";
import { ResetEmployeesButton } from "./reset-employees-button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Employee Management",
};

type SearchParams = {
  q?: string | string[];
  country?: string | string[];
  job?: string | string[];
  status?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = getParam(params.q).toLowerCase();
  const country = getParam(params.country);
  const job = getParam(params.job);
  const status = getParam(params.status);
  const pageSize = clampNumber(Number(getParam(params.pageSize)) || 25, 10, 100);
  const requestedPage = Math.max(1, Number(getParam(params.page)) || 1);
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

  const allEmployees = employees ?? [];
  const countries = uniqueSorted(allEmployees.map((employee) => employee.country_code).filter(Boolean));
  const jobs = uniqueSorted(allEmployees.map((employee) => employee.job_title).filter(Boolean));
  const filteredEmployees = allEmployees.filter((employee) => {
    const haystack = [
      employee.employee_id,
      employee.full_name,
      employee.email,
      employee.job_title,
      employee.country_code,
      employee.manager_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (country && employee.country_code !== country) return false;
    if (job && employee.job_title !== job) return false;
    if (status === "active" && !employee.active) return false;
    if (status === "inactive" && employee.active) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedEmployees = filteredEmployees.slice(start, start + pageSize);

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization&apos;s employee directory and profiles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ResetEmployeesButton employeeCount={allEmployees.length} />
          <Link href="/admin/employees/import" className={cn(buttonVariants({ variant: "outline" }))}>
            <Upload className="mr-2 h-4 w-4" />
            Import Basis File
          </Link>
          <EmployeeDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Directory ({filteredEmployees.length} of {allEmployees.length})</CardTitle>
          <CardDescription>
            All employee records currently registered in the hub.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="mb-4 grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <Input
                name="q"
                defaultValue={getParam(params.q)}
                placeholder="Search ID, name, email, title, manager..."
              />
            </div>
            <FilterSelect name="country" label="All countries" value={country} options={countries} />
            <FilterSelect name="job" label="All job titles" value={job} options={jobs} />
            <FilterSelect
              name="status"
              label="All statuses"
              value={status}
              options={[
                ["active", "Active"],
                ["inactive", "Inactive"],
              ]}
            />
            <FilterSelect
              name="pageSize"
              label="Page size"
              value={String(pageSize)}
              options={[
                ["10", "10 per page"],
                ["25", "25 per page"],
                ["50", "50 per page"],
                ["100", "100 per page"],
              ]}
            />
            <input type="hidden" name="page" value="1" />
            <div className="flex gap-2 md:col-span-6">
              <Button type="submit">Apply filters</Button>
              <Link href="/admin/employees" className={cn(buttonVariants({ variant: "outline" }))}>
                Clear
              </Link>
            </div>
          </form>
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
              {pagedEmployees.length > 0 ? (
                pagedEmployees.map((emp) => (
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
                    No employees match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
            <div className="text-muted-foreground">
              Showing {filteredEmployees.length === 0 ? 0 : start + 1}-
              {Math.min(start + pageSize, filteredEmployees.length)} of {filteredEmployees.length}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={pageHref(params, Math.max(1, currentPage - 1), pageSize)}
                aria-disabled={currentPage === 1}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  currentPage === 1 && "pointer-events-none opacity-50"
                )}
              >
                Previous
              </Link>
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Link
                href={pageHref(params, Math.min(totalPages, currentPage + 1), pageSize)}
                aria-disabled={currentPage === totalPages}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  currentPage === totalPages && "pointer-events-none opacity-50"
                )}
              >
                Next
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function uniqueSorted(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pageHref(params: SearchParams, page: number, pageSize: number) {
  const next = new URLSearchParams();
  for (const key of ["q", "country", "job", "status"] as const) {
    const value = getParam(params[key]);
    if (value) next.set(key, value);
  }
  next.set("page", String(page));
  next.set("pageSize", String(pageSize));
  return `/admin/employees?${next.toString()}`;
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[] | [string, string][];
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value="">{label}</option>
      {options.map((option) => {
        const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
        return (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        );
      })}
    </select>
  );
}
