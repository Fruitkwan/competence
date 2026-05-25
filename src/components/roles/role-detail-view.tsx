"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Award,
  Briefcase,
  ClipboardList,
  MapPin,
  Target,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { levelBadgeClass } from "@/lib/constants/competency-levels";
import {
  CompetencyDialog,
  KpiDialog,
  ProfileEditDialog,
  RemoveCompetencyButton,
  RemoveKpiButton,
} from "./role-edit-dialogs";

export type RoleProfileView = {
  title: string;
  department: string;
  reports_to: string | null;
  role_purpose: string | null;
  geographic_scope: string | null;
  responsibilities: string[];
  authority: string[];
  qualifications: Record<string, unknown>;
};

export type RoleCompetencyView = {
  competency_id: string;
  category: string;
  required_level: string | null;
  weight: number;
  name: string;
  description: string | null;
  behavioral_indicators: string | null;
};

export type RoleKpiView = {
  id: string;
  title: string;
  measure: string | null;
  target: string | null;
  review_frequency: string | null;
  default_weight: number;
};

type CatalogCompetency = {
  id: string;
  name: string;
  category: string;
};

type RoleDetailTab = "competencies" | "kpis" | "profile";

function normalizeTab(value: string | undefined): RoleDetailTab {
  if (value === "kpis" || value === "profile") return value;
  return "competencies";
}

function groupByCategory(items: RoleCompetencyView[]) {
  const groups = new Map<string, RoleCompetencyView[]>();
  for (const item of items) {
    const category = item.category?.trim() || "General";
    const list = groups.get(category) ?? [];
    list.push(item);
    groups.set(category, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function qualificationText(qualifications: Record<string, unknown>): string | null {
  if (typeof qualifications.experience === "string" && qualifications.experience.trim()) {
    return qualifications.experience.trim();
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(qualifications)) {
    if (typeof value === "string" && value.trim()) {
      parts.push(`${key}: ${value.trim()}`);
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

export function RoleDetailView({
  profile,
  competencies,
  kpis,
  defaultTab,
  canEdit = false,
  levels = [],
  catalogCompetencies = [],
  departments = [],
}: {
  profile: RoleProfileView;
  competencies: RoleCompetencyView[];
  kpis: RoleKpiView[];
  defaultTab?: string;
  canEdit?: boolean;
  levels?: string[];
  catalogCompetencies?: CatalogCompetency[];
  departments?: string[];
}) {
  const tab = normalizeTab(defaultTab);
  const qualification = qualificationText(profile.qualifications);
  const competencyGroups = groupByCategory(competencies);
  const linkedCompetencyIds = competencies.map((item) => item.competency_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/roles"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to role library
        </Link>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{profile.department}</Badge>
                {profile.geographic_scope && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" />
                    {profile.geographic_scope}
                  </Badge>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{profile.title}</h1>
                {profile.reports_to && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    Reports to {profile.reports_to}
                  </p>
                )}
              </div>
              {profile.role_purpose && (
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {profile.role_purpose}
                </p>
              )}
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:items-end">
              <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3">
                <StatPill
                  icon={Award}
                  label="Competencies"
                  value={competencies.length}
                  iconClassName="text-amber-500 dark:text-amber-400"
                  accentClassName="border-amber-200/60 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
                />
                <StatPill
                  icon={Target}
                  label="KPI templates"
                  value={kpis.length}
                  iconClassName="text-rose-500 dark:text-rose-400"
                  accentClassName="border-rose-200/60 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20"
                />
                <StatPill
                  icon={ClipboardList}
                  label="Responsibilities"
                  value={profile.responsibilities.length}
                  className="col-span-2 sm:col-span-1"
                  iconClassName="text-emerald-500 dark:text-emerald-400"
                  accentClassName="border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                />
              </div>
              {canEdit && (
                <ProfileEditDialog profile={profile} departments={departments} />
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue={tab}>
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-x-4 gap-y-2 overflow-visible">
          <TabsTrigger value="competencies" className="h-auto shrink-0 gap-1.5 px-0 py-1">
            <Award className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            Competencies
            <CountBadge count={competencies.length} />
          </TabsTrigger>
          <TabsTrigger value="kpis" className="h-auto shrink-0 gap-1.5 px-0 py-1">
            <Target className="h-4 w-4 text-rose-500 dark:text-rose-400" />
            KPI templates
            <CountBadge count={kpis.length} />
          </TabsTrigger>
          <TabsTrigger value="profile" className="h-auto shrink-0 gap-1.5 px-0 py-1">
            <Briefcase className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            Job profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="competencies" className="mt-6 space-y-6">
          {canEdit && (
            <div className="flex justify-end">
              <CompetencyDialog
                roleTitle={profile.title}
                levels={levels}
                catalog={catalogCompetencies}
                linkedIds={linkedCompetencyIds}
              />
            </div>
          )}
          {competencies.length ? (
            competencyGroups.map(([category, items]) => (
              <section key={category}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {category}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {items.length} {items.length === 1 ? "competency" : "competencies"}
                  </span>
                </div>
                <div className="grid gap-3">
                  {items.map((item) => (
                    <Card key={item.competency_id} className="shadow-none">
                      <CardContent className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <h3 className="font-medium leading-snug">{item.name}</h3>
                            {item.description && (
                              <p className="text-sm leading-relaxed text-muted-foreground">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn("font-medium", levelBadgeClass(item.required_level))}
                            >
                              {item.required_level ?? "Competent"}
                            </Badge>
                            {item.weight > 0 && (
                              <Badge variant="secondary" className="tabular-nums">
                                Weight {item.weight}
                              </Badge>
                            )}
                            {canEdit && (
                              <>
                                <CompetencyDialog
                                  roleTitle={profile.title}
                                  levels={levels}
                                  catalog={catalogCompetencies}
                                  linkedIds={linkedCompetencyIds}
                                  initial={item}
                                />
                                <RemoveCompetencyButton
                                  roleTitle={profile.title}
                                  competencyId={item.competency_id}
                                  name={item.name}
                                />
                              </>
                            )}
                          </div>
                        </div>
                        {item.behavioral_indicators && (
                          <div className="mt-3 rounded-md border border-dashed bg-muted/40 px-3 py-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              Behavioral indicators
                            </p>
                            <p className="mt-1 text-sm leading-relaxed">
                              {item.behavioral_indicators}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <EmptyPanel
              icon={Award}
              title="No competencies yet"
              description={
                canEdit
                  ? "Add competencies to define what this role requires."
                  : "Role competencies will appear here once imported from the role documents."
              }
              action={
                canEdit ? (
                  <CompetencyDialog
                    roleTitle={profile.title}
                    levels={levels}
                    catalog={catalogCompetencies}
                    linkedIds={linkedCompetencyIds}
                  />
                ) : undefined
              }
            />
          )}
        </TabsContent>

        <TabsContent value="kpis" className="mt-6">
          {canEdit && (
            <div className="mb-4 flex justify-end">
              <KpiDialog roleTitle={profile.title} department={profile.department} />
            </div>
          )}
          {kpis.length ? (
            <Card className="overflow-hidden shadow-none">
              <CardContent className="divide-y p-0">
                {kpis.map((kpi) => (
                  <div key={kpi.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium leading-snug">{kpi.title}</div>
                        {kpi.measure && (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {kpi.measure}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 items-center gap-1">
                          <KpiDialog
                            roleTitle={profile.title}
                            department={profile.department}
                            initial={kpi}
                          />
                          <RemoveKpiButton id={kpi.id} roleTitle={profile.title} title={kpi.title} />
                        </div>
                      )}
                    </div>
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Target
                        </dt>
                        <dd className="mt-1 text-sm leading-relaxed break-words">
                          {kpi.target ?? "—"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Frequency
                        </dt>
                        <dd className="mt-1 text-sm leading-relaxed break-words">
                          {kpi.review_frequency ?? "—"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Weight
                        </dt>
                        <dd className="mt-1 text-sm tabular-nums text-muted-foreground">
                          {kpi.default_weight > 0 ? kpi.default_weight : "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <EmptyPanel
              icon={Target}
              title="No KPI templates yet"
              description={
                canEdit
                  ? "Add KPI templates to define how success is measured for this role."
                  : "KPI templates linked to this role will show up here after import."
              }
              action={
                canEdit ? (
                  <KpiDialog roleTitle={profile.title} department={profile.department} />
                ) : undefined
              }
            />
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          {canEdit && (
            <div className="mb-4 flex justify-end">
              <ProfileEditDialog profile={profile} departments={departments} />
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Responsibilities</CardTitle>
              </CardHeader>
              <CardContent>
                {profile.responsibilities.length ? (
                  <ul className="space-y-2.5">
                    {profile.responsibilities.map((item, index) => (
                      <li
                        key={`${index}-${item.slice(0, 24)}`}
                        className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No responsibilities imported yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Qualifications</CardTitle>
              </CardHeader>
              <CardContent>
                {qualification ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">{qualification}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No detailed qualifications imported yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {profile.authority.length > 0 && (
              <Card className="shadow-none lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Authority</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {profile.authority.map((item, index) => (
                      <li
                        key={`${index}-${item.slice(0, 24)}`}
                        className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  className,
  iconClassName,
  accentClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  className?: string;
  iconClassName?: string;
  accentClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 px-3 py-2.5 text-center",
        accentClassName,
        className,
      )}
    >
      <Icon className={cn("mx-auto mb-1 h-4 w-4", iconClassName ?? "text-muted-foreground")} />
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal tabular-nums text-muted-foreground">
      {count}
    </span>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-3 rounded-full bg-muted p-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}
