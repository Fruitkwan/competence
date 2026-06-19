import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

type AppraisalRow = {
  id: string;
  employee_id: string;
  full_name: string;
  job_title: string;
  cluster: string;
  country_code: string | null;
  manager_name: string | null;
  appraisal_date: string;
  current_avg: number;
  gap: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: string;
  recommended_course: string | null;
  target_completion: string | null;
  overdue: boolean;
};

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  priority?: string | string[];
  cluster?: string | string[];
  country?: string | string[];
  overdue?: string | string[];
  scope?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
};

const SCOPE_OPTIONS: Array<[string, string]> = [
  ["own", "My appraisals"],
  ["team", "My team"],
  ["all", "All"],
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export default async function AppraisalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Role + identity (used for default scope and "My team" / "My appraisals").
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "employee";
  const myFullName = profile?.full_name ?? null;

  const { data: myEmployee } = await supabase
    .from("employees")
    .select("employee_id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const myEmployeeId = myEmployee?.employee_id ?? null;
  const myDisplayName = myEmployee?.full_name ?? myFullName;

  // Default scope: employee→own, manager→team, hr/exec→all.
  const allowedScopes = new Set(
    role === "employee"
      ? ["own"]
    : role === "manager"
      ? ["own", "team"]
      : ["own", "team", "all"],
  );
  const requestedScope = getParam(params.scope);
  const scope =
    requestedScope && allowedScopes.has(requestedScope)
      ? requestedScope
      : role === "employee"
      ? "own"
      : role === "manager"
      ? "team"
      : "all";

  // Filter values from URL.
  const query = getParam(params.q).toLowerCase().trim();
  const status = getParam(params.status);
  const priority = getParam(params.priority);
  const cluster = getParam(params.cluster);
  const country = getParam(params.country);
  const overdueOnly = getParam(params.overdue) === "1";

  const pageSize = clamp(Number(getParam(params.pageSize)) || 25, 10, 100);
  const requestedPage = Math.max(1, Number(getParam(params.page)) || 1);

  // Scope at query time for security; everything else client-side.
  let q = supabase
    .from("appraisal_full")
    .select(
      "id, employee_id, full_name, job_title, cluster, country_code, manager_name, appraisal_date, current_avg, gap, priority, status, recommended_course, target_completion, overdue",
    )
    .order("appraisal_date", { ascending: false });

  if (scope === "own") {
    if (!myEmployeeId) {
      return <NotLinked />;
    }
    q = q.eq("employee_id", myEmployeeId);
  } else if (scope === "team") {
    if (!myDisplayName) {
      return <NotLinked />;
    }
    q = q.eq("manager_name", myDisplayName);
  }

  const { data, error } = await q;
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">
          Failed to load appraisals: {error.message}
        </CardContent>
      </Card>
    );
  }

  const all = (data ?? []) as AppraisalRow[];
  const clusters = uniqueSorted(all.map((r) => r.cluster));
  const countries = uniqueSorted(
    all.map((r) => r.country_code).filter((v): v is string => Boolean(v)),
  );

  const filtered = all.filter((r) => {
    if (query) {
      const hay = [
        r.employee_id,
        r.full_name,
        r.job_title,
        r.recommended_course,
        r.manager_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    if (status && r.status !== status) return false;
    if (priority && r.priority !== priority) return false;
    if (cluster && r.cluster !== cluster) return false;
    if (country && r.country_code !== country) return false;
    if (overdueOnly && !r.overdue) return false;
    return true;
  });

  // KPI strip uses the filtered set (so it tracks what's visible).
  const kpis = computeKpis(filtered);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  // Build the same query-string for export so the spreadsheet matches the view.
  const exportHref = `/api/export/appraisals?${buildQuery(params, {
    scope,
    page: undefined,
    pageSize: undefined,
  })}`;

  const canCreate = role === "admin" || role === "manager";

  return (
    <>
      <PageHeader
        title="Appraisals"
        description={`${filtered.length} of ${all.length} appraisals.`}
        actions={
          <>
            <Link
              href={exportHref}
              className={buttonVariants({ variant: "outline" })}
            >
              Export .xlsx
            </Link>
            {canCreate && (
              <Link href="/appraisals/new" className={buttonVariants()}>
                New appraisal
              </Link>
            )}
          </>
        }
      />

      <KpiStrip kpis={kpis} />

      <Card className="mt-4">
        <CardContent className="pt-6">
          <form className="mb-4 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <Input
                name="q"
                defaultValue={getParam(params.q)}
                placeholder="Search ID, name, title, manager, course..."
              />
            </div>
            <FilterSelect
              className="md:col-span-2"
              name="scope"
              label="Scope"
              value={scope}
              options={SCOPE_OPTIONS.filter(([v]) => allowedScopes.has(v))}
            />
            <FilterSelect
              className="md:col-span-2"
              name="status"
              label="All statuses"
              value={status}
              options={[
                ["Not Started", "Not Started"],
                ["In Progress", "In Progress"],
                ["Completed", "Completed"],
                ["Cancelled", "Cancelled"],
              ]}
            />
            <FilterSelect
              className="md:col-span-2"
              name="priority"
              label="All priorities"
              value={priority}
              options={[
                ["HIGH", "High"],
                ["MEDIUM", "Medium"],
                ["LOW", "Low"],
              ]}
            />
            <FilterSelect
              className="md:col-span-2"
              name="cluster"
              label="All clusters"
              value={cluster}
              options={clusters.map((c) => [c, c] as [string, string])}
            />
            <FilterSelect
              className="md:col-span-2"
              name="country"
              label="All countries"
              value={country}
              options={countries.map((c) => [c, c] as [string, string])}
            />
            <FilterSelect
              className="md:col-span-2"
              name="pageSize"
              label="Page size"
              value={String(pageSize)}
              options={PAGE_SIZE_OPTIONS.map(
                (n) => [String(n), `${n} per page`] as [string, string],
              )}
            />
            <label className="flex items-center gap-2 text-sm md:col-span-3">
              <input
                type="checkbox"
                name="overdue"
                value="1"
                defaultChecked={overdueOnly}
                className="h-4 w-4 rounded border-input"
              />
              Only overdue
            </label>
            <input type="hidden" name="page" value="1" />

            <div className="flex flex-wrap gap-2 md:col-span-12">
              <Button type="submit">Apply filters</Button>
              <Link
                href="/appraisals"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Clear
              </Link>
            </div>
          </form>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Cluster</TableHead>
                  <TableHead>Avg</TableHead>
                  <TableHead>Gap</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Recommended</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length > 0 ? (
                  paged.map((a) => (
                    <TableRow
                      key={a.id}
                      className={
                        a.overdue ? "bg-red-50/40 dark:bg-red-900/10" : ""
                      }
                    >
                      <TableCell>{formatDate(a.appraisal_date)}</TableCell>
                      <TableCell>
                        <Link
                          href={`/appraisals/${a.id}`}
                          className="hover:underline"
                        >
                          <div className="font-medium">{a.full_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {a.employee_id} · {a.job_title}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>{a.cluster}</TableCell>
                      <TableCell>{Number(a.current_avg).toFixed(2)}</TableCell>
                      <TableCell>{Number(a.gap).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={priorityColor[a.priority]}
                        >
                          {a.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {a.recommended_course ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColor[a.status]}
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(a.target_completion)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No appraisals match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
            <div className="text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : start + 1}-
              {Math.min(start + pageSize, filtered.length)} of {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/appraisals?${buildQuery(params, {
                  page: Math.max(1, currentPage - 1),
                  pageSize,
                  scope,
                })}`}
                aria-disabled={currentPage === 1}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  currentPage === 1 && "pointer-events-none opacity-50",
                )}
              >
                Previous
              </Link>
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Link
                href={`/appraisals?${buildQuery(params, {
                  page: Math.min(totalPages, currentPage + 1),
                  pageSize,
                  scope,
                })}`}
                aria-disabled={currentPage === totalPages}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  currentPage === totalPages &&
                    "pointer-events-none opacity-50",
                )}
              >
                Next
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function computeKpis(rows: AppraisalRow[]) {
  const total = rows.length;
  const avgGap = total === 0
    ? 0
    : rows.reduce((sum, r) => sum + (Number(r.gap) || 0), 0) / total;
  const highPriority = rows.filter((r) => r.priority === "HIGH").length;
  const overdue = rows.filter((r) => r.overdue).length;
  return { total, avgGap, highPriority, overdue };
}

function KpiStrip({
  kpis,
}: {
  kpis: { total: number; avgGap: number; highPriority: number; overdue: number };
}) {
  const tiles: Array<{
    label: string;
    value: string;
    tone?: "danger" | "warning" | "muted";
  }> = [
    { label: "Total", value: String(kpis.total) },
    { label: "Average gap", value: kpis.avgGap.toFixed(2), tone: "muted" },
    {
      label: "High priority",
      value: String(kpis.highPriority),
      tone: kpis.highPriority > 0 ? "warning" : "muted",
    },
    {
      label: "Overdue",
      value: String(kpis.overdue),
      tone: kpis.overdue > 0 ? "danger" : "muted",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t.label}
            </div>
            <div
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums",
                t.tone === "danger" && "text-red-600 dark:text-red-400",
                t.tone === "warning" && "text-amber-600 dark:text-amber-400",
              )}
            >
              {t.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NotLinked() {
  return (
    <Card>
      <CardContent className="py-8 text-sm text-muted-foreground">
        Your account is not linked to an employee record yet. Ask HR to link
        your user to your employee profile to see your appraisals here.
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  className,
  name,
  label,
  value,
  options,
}: {
  className?: string;
  name: string;
  label: string;
  value: string;
  options: Array<[string, string]>;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      className={cn(
        "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <option value="">{label}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function buildQuery(
  params: SearchParams,
  overrides: Partial<{
    page: number | undefined;
    pageSize: number | undefined;
    scope: string;
  }> = {},
) {
  const next = new URLSearchParams();
  const carry: (keyof SearchParams)[] = [
    "q",
    "status",
    "priority",
    "cluster",
    "country",
    "overdue",
  ];
  for (const key of carry) {
    const v = getParam(params[key]);
    if (v) next.set(key, v);
  }
  if (overrides.scope) next.set("scope", overrides.scope);
  else {
    const s = getParam(params.scope);
    if (s) next.set("scope", s);
  }
  if (overrides.page != null) next.set("page", String(overrides.page));
  if (overrides.pageSize != null)
    next.set("pageSize", String(overrides.pageSize));
  return next.toString();
}
