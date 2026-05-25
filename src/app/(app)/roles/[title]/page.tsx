import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RoleDetailView,
  type RoleCompetencyView,
  type RoleKpiView,
  type RoleProfileView,
} from "@/components/roles/role-detail-view";

export default async function RoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ title: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { title: encodedTitle } = await params;
  const { tab } = await searchParams;
  const title = decodeURIComponent(encodedTitle);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userProfile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const canEdit = userProfile?.role === "admin";

  const { data: profile } = await supabase
    .from("job_profiles")
    .select("*")
    .eq("title", title)
    .single();

  if (!profile) notFound();

  const [
    { data: roleCompetencies },
    { data: kpis },
    { data: levels },
    { data: catalogCompetencies },
    { data: departments },
  ] = await Promise.all([
    supabase
      .from("role_competencies")
      .select("competency_id, category, required_level, weight, sort_order")
      .eq("role_title", title)
      .eq("applicable", true)
      .order("sort_order"),
    supabase
      .from("role_kpi_templates")
      .select("id, title, measure, target, review_frequency, default_weight, sort_order")
      .eq("role_title", title)
      .eq("active", true)
      .order("sort_order"),
    supabase.from("competency_levels").select("label").order("numeric_value"),
    supabase.from("competencies").select("id, name, category").order("name"),
    supabase.from("departments").select("name").order("name"),
  ]);

  const competencyIds = roleCompetencies?.map((item) => item.competency_id) ?? [];
  const { data: competencies } = competencyIds.length
    ? await supabase
        .from("competencies")
        .select("id, name, description, behavioral_indicators")
        .in("id", competencyIds)
    : { data: [] };

  const competencyById = new Map((competencies ?? []).map((item) => [item.id, item]));

  const profileView: RoleProfileView = {
    title: profile.title,
    department: profile.department,
    reports_to: profile.reports_to,
    role_purpose: profile.role_purpose,
    geographic_scope: profile.geographic_scope,
    responsibilities: profile.responsibilities,
    authority: profile.authority,
    qualifications: profile.qualifications,
  };

  const competencyViews: RoleCompetencyView[] = (roleCompetencies ?? []).map((link) => {
    const competency = competencyById.get(link.competency_id);
    return {
      competency_id: link.competency_id,
      category: link.category,
      required_level: link.required_level,
      weight: link.weight,
      name: competency?.name ?? "Unknown competency",
      description: competency?.description ?? null,
      behavioral_indicators: competency?.behavioral_indicators ?? null,
    };
  });

  const kpiViews: RoleKpiView[] = (kpis ?? []).map((kpi) => ({
    id: kpi.id,
    title: kpi.title,
    measure: kpi.measure,
    target: kpi.target,
    review_frequency: kpi.review_frequency,
    default_weight: kpi.default_weight,
  }));

  const departmentNames = [
    ...new Set([
      ...(departments ?? []).map((item) => item.name),
      profile.department,
    ]),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <RoleDetailView
      profile={profileView}
      competencies={competencyViews}
      kpis={kpiViews}
      defaultTab={tab}
      canEdit={canEdit}
      levels={(levels ?? []).map((item) => item.label)}
      catalogCompetencies={catalogCompetencies ?? []}
      departments={departmentNames}
    />
  );
}
