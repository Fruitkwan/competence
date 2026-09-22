"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight, CircleAlert, Expand, MapPin, Search, Shrink, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrgNode } from "@/lib/organization-chart";
import { cn } from "@/lib/utils";
import styles from "./organization-chart.module.css";

type Props = { nodes: OrgNode[]; roots: string[]; unresolvedManagers: number; currentEmployeeId: string | null };

export function OrganizationChart({ nodes, roots, unresolvedManagers, currentEmployeeId }: Props) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [country, setCountry] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(currentEmployeeId ?? roots[0] ?? null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(nodes.filter((node) => node.parent_id !== null && node.direct_reports > 0).map((node) => node.employee_id)));
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
      if (!matchesText || (department && node.department !== department) || (country && node.country_code !== country)) continue;
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
  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 flex-1 lg:basis-[360px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="border-0 bg-muted/45 pl-9 shadow-none" placeholder="Search name, employee ID, title, or department…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <select aria-label="Department" className="h-9 min-w-0 max-w-full rounded-lg border bg-background px-3 text-sm" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">All departments</option>{departments.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Country" className="h-9 min-w-0 max-w-full rounded-lg border bg-background px-3 text-sm" value={country} onChange={(event) => setCountry(event.target.value)}><option value="">All countries</option>{countries.map((value) => <option key={value}>{value}</option>)}</select>
        <Button size="sm" variant="outline" onClick={() => setCollapsed(new Set())}><Expand /> Expand</Button>
        <Button size="sm" variant="outline" onClick={() => setCollapsed(new Set(nodes.filter((node) => node.direct_reports > 0).map((node) => node.employee_id)))}><Shrink /> Collapse</Button>
      </div>

      {unresolvedManagers > 0 && <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>{unresolvedManagers} manager {unresolvedManagers === 1 ? "record is" : "records are"} missing from the active employee directory. Their reporting lines remain visible as dashed cards.</p></div>}

      <section className={styles.canvas} aria-label="Company organization chart">
        <div className={styles.canvasInner}>
          {roots.filter((id) => !visible || visible.has(id)).map((id) => <OrgBranch key={id} id={id} nodeById={nodeById} childrenById={childrenById} collapsed={collapsed} visible={visible} selectedId={selectedId} currentEmployeeId={currentEmployeeId} onToggle={toggle} onSelect={setSelectedId} />)}
          {visible && visible.size === 0 && <div className="py-24 text-center text-sm text-muted-foreground">No positions match the current filters.</div>}
        </div>
      </section>

      {selected && <EmployeeDetails node={selected} current={selected.employee_id === currentEmployeeId} />}
    </div>
  );
}

function OrgBranch({ id, nodeById, childrenById, collapsed, visible, selectedId, currentEmployeeId, onToggle, onSelect }: { id: string; nodeById: Map<string, OrgNode>; childrenById: Map<string, string[]>; collapsed: Set<string>; visible: Set<string> | null; selectedId: string | null; currentEmployeeId: string | null; onToggle: (id: string) => void; onSelect: (id: string) => void }) {
  const node = nodeById.get(id);
  if (!node || (visible && !visible.has(id))) return null;
  const children = (childrenById.get(id) ?? []).filter((childId) => !visible || visible.has(childId));
  const closed = !visible && collapsed.has(id);
  return <div className={styles.branch}>
    <EmployeeCard node={node} selected={selectedId === id} current={currentEmployeeId === id} closed={closed} hasChildren={children.length > 0} onSelect={() => onSelect(id)} onToggle={() => onToggle(id)} />
    {!closed && children.length > 0 && <div className={styles.children}>{children.map((childId) => <OrgBranch key={childId} id={childId} nodeById={nodeById} childrenById={childrenById} collapsed={collapsed} visible={visible} selectedId={selectedId} currentEmployeeId={currentEmployeeId} onToggle={onToggle} onSelect={onSelect} />)}</div>}
  </div>;
}

function EmployeeCard({ node, selected, current, closed, hasChildren, onSelect, onToggle }: { node: OrgNode; selected: boolean; current: boolean; closed: boolean; hasChildren: boolean; onSelect: () => void; onToggle: () => void }) {
  return <div className={cn(styles.personCard, selected && styles.selected, node.placeholder && styles.placeholder)}>
    <button type="button" className={styles.personMain} onClick={onSelect} aria-label={`View ${node.full_name}`}>
      <span className={styles.avatar}>{initials(node.full_name)}</span>
      <span className={styles.personText}><span className={styles.personName}>{node.full_name}</span><span className={styles.personTitle}>{node.job_title}</span></span>
      {current && <span className={styles.you}>You</span>}
    </button>
    {!node.placeholder && <div className={styles.assessments}>
      {node.assessments === undefined ? <p className={styles.assessmentEmpty}>Assessment details are private</p> : node.assessments.length === 0 ? <p className={styles.assessmentEmpty}>No completed assessments</p> : node.assessments.map((assessment) => <div key={assessment.id} className={styles.assessment}>
        <div className={styles.scoreRow}><Link href={`/assessments/${assessment.id}/report`}>{assessment.name}</Link><strong>{assessment.score == null ? "Pending" : `${assessment.score}%`}</strong></div>
        {assessment.wave && <p className={styles.assessmentEmpty}>{assessment.wave}</p>}
        {assessment.provisional && assessment.score != null && <span className={styles.provisional}>Provisional</span>}
        {assessment.raters !== null && <p className={styles.raters}><span>Raters:</span> {assessment.raters.length ? assessment.raters.join(", ") : "None assigned"}</p>}
      </div>)}
    </div>}
    {hasChildren && <button type="button" className={styles.toggle} onClick={onToggle} aria-expanded={!closed} aria-label={`${closed ? "Expand" : "Collapse"} ${node.full_name}`}>{closed ? <ChevronRight /> : <ChevronDown />}</button>}
  </div>;
}

function EmployeeDetails({ node, current }: { node: OrgNode; current: boolean }) {
  return <section className={styles.detailPanel} aria-label={`${node.full_name} details`}>
    <div className={styles.detailIdentity}>
      <div className={styles.detailAvatar}>{initials(node.full_name)}{current && <span className={styles.verified}>✓</span>}</div>
      <div className="min-w-0"><p className="truncate text-lg font-semibold">{node.full_name}</p><p className="truncate text-sm text-muted-foreground">{node.job_title}</p></div>
      {!node.placeholder && <Link href={`/employees/${node.employee_id}`} className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md bg-violet-600 px-3 text-sm font-medium text-white transition-colors hover:bg-violet-700 sm:w-fit">View profile</Link>}
    </div>
    <div className={styles.metrics}>
      <Metric icon={UsersRound} value={node.direct_reports} label="Direct reports" />
      <Metric icon={UserRound} value={node.total_reports} label="Total team" />
      <Metric icon={Building2} value={node.department ?? "—"} label="Department" />
      <Metric icon={MapPin} value={node.country_code ?? "—"} label="Country" />
    </div>
  </section>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof UsersRound; value: string | number; label: string }) {
  return <div className={styles.metric}><Icon /><div className="min-w-0"><p className="truncate font-semibold text-violet-600">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></div>;
}

function unique(values: (string | null)[]) { return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(); }
function initials(name: string) { const parts = name.trim().split(/\s+/); return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toUpperCase(); }
