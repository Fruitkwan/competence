"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight, CircleAlert, Expand, Search, Shrink, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { OrgNode } from "@/lib/organization-chart";
import { cn } from "@/lib/utils";

type Props = {
  nodes: OrgNode[];
  roots: string[];
  unresolvedManagers: number;
  currentEmployeeId: string | null;
};

export function OrganizationChart({ nodes, roots, unresolvedManagers, currentEmployeeId }: Props) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [country, setCountry] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(nodes.filter((node) => node.total_reports > 10).map((node) => node.employee_id)));
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.employee_id, node])), [nodes]);
  const childrenById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const node of nodes) {
      if (!node.parent_id) continue;
      map.set(node.parent_id, [...(map.get(node.parent_id) ?? []), node.employee_id]);
    }
    for (const ids of map.values()) ids.sort((a, b) => nodeById.get(a)!.full_name.localeCompare(nodeById.get(b)!.full_name));
    return map;
  }, [nodes, nodeById]);

  const departments = useMemo(() => unique(nodes.map((node) => node.department)), [nodes]);
  const countries = useMemo(() => unique(nodes.map((node) => node.country_code)), [nodes]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term && !department && !country) return null;
    const ids = new Set<string>();
    for (const node of nodes) {
      const matchesText = !term || `${node.full_name} ${node.employee_id} ${node.job_title} ${node.department ?? ""}`.toLowerCase().includes(term);
      const matchesDepartment = !department || node.department === department;
      const matchesCountry = !country || node.country_code === country;
      if (!matchesText || !matchesDepartment || !matchesCountry) continue;
      ids.add(node.employee_id);
      let parentId = node.parent_id;
      while (parentId) {
        if (ids.has(parentId)) break;
        ids.add(parentId);
        parentId = nodeById.get(parentId)?.parent_id ?? null;
      }
    }
    return ids;
  }, [country, department, nodeById, nodes, query]);

  const employeeCount = nodes.filter((node) => !node.placeholder).length;
  const leaderCount = nodes.filter((node) => !node.placeholder && node.direct_reports > 0).length;

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Employees" value={employeeCount} icon={UsersRound} />
        <Summary label="People managers" value={leaderCount} icon={UserRound} />
        <Summary label="Departments" value={departments.length} icon={Building2} />
        <Summary label="Unmatched managers" value={unresolvedManagers} icon={CircleAlert} warning={unresolvedManagers > 0} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Find a position</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search name, employee ID, title, or department…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">All departments</option>{departments.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm" value={country} onChange={(event) => setCountry(event.target.value)}><option value="">All countries</option>{countries.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <Button variant="outline" onClick={() => setCollapsed(new Set())}><Expand className="h-4 w-4" /> Expand all</Button>
          <Button variant="outline" onClick={() => setCollapsed(new Set(nodes.filter((node) => node.direct_reports > 0).map((node) => node.employee_id)))}><Shrink className="h-4 w-4" /> Collapse all</Button>
        </CardContent>
      </Card>

      {unresolvedManagers > 0 && <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>{unresolvedManagers} reporting manager {unresolvedManagers === 1 ? "name is" : "names are"} not present as an active employee. Placeholder manager cards keep those reporting lines visible until the directory is corrected.</p></div>}

      <Card>
        <CardContent className="overflow-x-auto p-4 sm:p-6">
          <div className="min-w-[680px] space-y-3">
            {roots.filter((id) => !visible || visible.has(id)).map((id) => (
              <OrgTree key={id} id={id} depth={0} nodeById={nodeById} childrenById={childrenById} collapsed={collapsed} visible={visible} currentEmployeeId={currentEmployeeId} onToggle={toggle} />
            ))}
            {visible && visible.size === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No positions match the current filters.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OrgTree({ id, depth, nodeById, childrenById, collapsed, visible, currentEmployeeId, onToggle }: { id: string; depth: number; nodeById: Map<string, OrgNode>; childrenById: Map<string, string[]>; collapsed: Set<string>; visible: Set<string> | null; currentEmployeeId: string | null; onToggle: (id: string) => void }) {
  const node = nodeById.get(id);
  if (!node || (visible && !visible.has(id))) return null;
  const children = (childrenById.get(id) ?? []).filter((childId) => !visible || visible.has(childId));
  const closed = !visible && collapsed.has(id);
  return (
    <div className="relative">
      <div className="flex items-stretch" style={{ paddingLeft: `${depth * 32}px` }}>
        {depth > 0 && <div className="relative w-6 shrink-0 before:absolute before:-top-3 before:bottom-1/2 before:left-0 before:border-l before:border-border after:absolute after:left-0 after:top-1/2 after:w-6 after:border-t after:border-border" />}
        <button type="button" aria-label={children.length ? `${closed ? "Expand" : "Collapse"} ${node.full_name}` : undefined} onClick={() => children.length && onToggle(id)} className={cn("mr-2 flex w-7 shrink-0 items-center justify-center text-muted-foreground", !children.length && "cursor-default")}>
          {children.length ? closed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-border" />}
        </button>
        <div className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-card p-3 shadow-sm", node.employee_id === currentEmployeeId && "border-primary ring-2 ring-primary/15", node.placeholder && "border-dashed bg-amber-50/50")}>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary", node.placeholder && "bg-amber-100 text-amber-800")}>{initials(node.full_name)}</div>
          <div className="min-w-0 flex-1">
            {node.placeholder ? <p className="truncate font-medium">{node.full_name}</p> : <Link href={`/employees/${node.employee_id}`} className="truncate font-medium hover:underline">{node.full_name}</Link>}
            <p className="truncate text-sm text-muted-foreground">{node.job_title}</p>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">{node.department && <span>{node.department}</span>}{node.country_code && <span>· {node.country_code}</span>}{node.employee_id === currentEmployeeId && <Badge variant="outline" className="h-5">You</Badge>}</div>
          </div>
          {node.direct_reports > 0 && <div className="shrink-0 text-right"><p className="text-lg font-semibold tabular-nums">{node.direct_reports}</p><p className="text-[11px] text-muted-foreground">direct · {node.total_reports} total</p></div>}
        </div>
      </div>
      {!closed && children.length > 0 && <div className="mt-3 space-y-3">{children.map((childId) => <OrgTree key={childId} id={childId} depth={depth + 1} nodeById={nodeById} childrenById={childrenById} collapsed={collapsed} visible={visible} currentEmployeeId={currentEmployeeId} onToggle={onToggle} />)}</div>}
    </div>
  );
}

function Summary({ label, value, icon: Icon, warning = false }: { label: string; value: number; icon: typeof UsersRound; warning?: boolean }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className={cn("rounded-lg bg-primary/10 p-2 text-primary", warning && "bg-amber-100 text-amber-700")}><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}

function unique(values: (string | null)[]) { return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(); }
function initials(name: string) { const parts = name.trim().split(/\s+/); return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toUpperCase(); }
