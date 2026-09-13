import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { priorityColor } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchParams = {
  q?: string | string[];
  country?: string | string[];
  department?: string | string[];
  job?: string | string[];
  status?: string | string[];
  priority?: string | string[];
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
  const department = getParam(params.department);
  const job = getParam(params.job);
  const status = getParam(params.status);
  const priority = getParam(params.priority);
  const pageSize = clampNumber(Number(getParam(params.pageSize)) || 25, 10, 100);
  const requestedPage = Math.max(1, Number(getParam(params.page)) || 1);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: employees }, { data: latest }] = await Promise.all([
    user
      ? supabase.from("profiles").select("role, employee_id, full_name, country_code").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("employees")
      .select("employee_id, full_name, job_title, department, country_code, manager_name, active")
      .order("employee_id"),
    supabase
      .from("appraisal_full")
      .select("employee_id, priority, current_avg, gap, status, appraisal_date"),
  ]);

  const latestByEmp = new Map<string, { priority: string; avg: number; gap: number; status: string; date: string }>();
  (latest ?? []).forEach((r) => {
    const prev = latestByEmp.get(r.employee_id);
    if (!prev || prev.date < r.appraisal_date) {
      latestByEmp.set(r.employee_id, {
        priority: r.priority,
        avg: Number(r.current_avg ?? 0),
        gap: Number(r.gap ?? 0),
        status: r.status,
        date: r.appraisal_date,
      });
    }
  });

  const rawEmployees = employees ?? [];
  if (profile?.role === "employee") redirect("/dashboard");

  const managerEmployee = profile?.role === "manager"
    ? rawEmployees.find((e) => e.employee_id === profile.employee_id)
    : null;
  const managerName = managerEmployee?.full_name ?? profile?.full_name;
  const managerCountry = canonicalCountry(profile?.country_code ?? managerEmployee?.country_code);
  const allEmployees = profile?.role === "manager"
    ? rawEmployees.filter((e) =>
        sameText(e.manager_name, managerName) &&
        (!managerCountry || canonicalCountry(e.country_code) === managerCountry)
      )
    : rawEmployees;
  const countries = uniqueSorted(allEmployees.map((e) => e.country_code).filter(Boolean));
  const departments = uniqueSorted(allEmployees.map((e) => e.department).filter(Boolean));
  const jobs = uniqueSorted(allEmployees.map((e) => e.job_title).filter(Boolean));
  const priorities = uniqueSorted(
    allEmployees
      .map((e) => latestByEmp.get(e.employee_id)?.priority)
      .filter(Boolean)
  );

  const filteredEmployees = allEmployees.filter((employee) => {
    const latestStatus = latestByEmp.get(employee.employee_id);
    const haystack = [
      employee.employee_id,
      employee.full_name,
      employee.job_title,
      employee.department,
      employee.country_code,
      employee.manager_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (country && employee.country_code !== country) return false;
    if (department && employee.department !== department) return false;
    if (job && employee.job_title !== job) return false;
    if (status === "active" && !employee.active) return false;
    if (status === "inactive" && employee.active) return false;
    if (priority && latestStatus?.priority !== priority) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedEmployees = filteredEmployees.slice(start, start + pageSize);

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${filteredEmployees.length} of ${allEmployees.length} employees across all clusters and countries.`}
      />
      <Card className="mb-4">
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-7">
            <div className="md:col-span-2">
              <Input
                name="q"
                defaultValue={getParam(params.q)}
                placeholder="Search ID, name, title, manager..."
              />
            </div>
            <FilterSelect name="country" label="All countries" value={country} options={countries} />
            <FilterSelect name="department" label="All departments" value={department} options={departments} />
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
            <FilterSelect name="priority" label="All priorities" value={priority} options={priorities} />
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
            <div className="flex gap-2 md:col-span-7">
              <Button type="submit">Apply filters</Button>
              <Link href="/employees" className={cn(buttonVariants({ variant: "outline" }))}>
                Clear
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Latest priority</TableHead>
              <TableHead>Gap</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedEmployees.length ? pagedEmployees.map((e) => {
              const l = latestByEmp.get(e.employee_id);
              return (
                <TableRow key={e.employee_id}>
                  <TableCell className="font-mono text-xs">
                    <Link className="hover:underline" href={`/employees/${e.employee_id}`}>
                      {e.employee_id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={`/employees/${e.employee_id}`}>
                      {e.full_name}
                    </Link>
                  </TableCell>
                  <TableCell>{e.job_title}</TableCell>
                  <TableCell>{e.department ?? "—"}</TableCell>
                  <TableCell>{e.country_code ?? "—"}</TableCell>
                  <TableCell>{e.manager_name ?? "—"}</TableCell>
                  <TableCell>
                    {l ? (
                      <Badge variant="outline" className={priorityColor[l.priority]}>
                        {l.priority}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{l ? l.gap.toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l ? l.status : "—"}
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  No employees match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
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
      </Card>
    </>
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

function sameText(a: string | null | undefined, b: string | null | undefined) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function canonicalCountry(value: string | null | undefined) {
  const country = value?.trim().toUpperCase();
  return country === "KSA" ? "SA" : country;
}

function pageHref(params: SearchParams, page: number, pageSize: number) {
  const next = new URLSearchParams();
  for (const key of ["q", "country", "department", "job", "status", "priority"] as const) {
    const value = getParam(params[key]);
    if (value) next.set(key, value);
  }
  next.set("page", String(page));
  next.set("pageSize", String(pageSize));
  return `/employees?${next.toString()}`;
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
