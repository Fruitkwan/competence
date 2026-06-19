"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  PerformanceAppraisalForm,
  CompetencyEntry,
  GoalRow,
} from "@/lib/supabase/performance-appraisal-types";
import { RATING_LABELS } from "@/lib/supabase/performance-appraisal-types";

interface ScoreSummaryProps {
  form: PerformanceAppraisalForm;
}

function avgRatings(entries: CompetencyEntry[], side: "rating_n1" | "rating_n2"): number | null {
  const vals = entries.map((e) => e[side]).filter((v) => v != null) as number[];
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function avgGoalRatings(goals: GoalRow[], side: "rating_n1" | "rating_n2"): number | null {
  const vals = goals.map((g) => g[side]).filter((v) => v != null) as number[];
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

interface SectionScore {
  label: string;
  weight: number;
  n1: number | null;
  n2: number | null;
  weighted_n1: number | null;
  weighted_n2: number | null;
}

export function ScoreSummary({ form }: ScoreSummaryProps) {
  const sections: SectionScore[] = useMemo(() => {
    const a_n1 = avgGoalRatings(form.goals, "rating_n1");
    const a_n2 = avgGoalRatings(form.goals, "rating_n2");

    const coreEntries = Object.values(form.core_competencies);
    const b_n1 = avgRatings(coreEntries, "rating_n1");
    const b_n2 = avgRatings(coreEntries, "rating_n2");

    const leaderEntries = form.leadership_applicable
      ? Object.values(form.leadership)
      : [];
    const c_n1 = leaderEntries.length ? avgRatings(leaderEntries, "rating_n1") : null;
    const c_n2 = leaderEntries.length ? avgRatings(leaderEntries, "rating_n2") : null;

    const valEntries = Object.values(form.values_culture);
    const d_n1 = avgRatings(valEntries, "rating_n1");
    const d_n2 = avgRatings(valEntries, "rating_n2");

    return [
      {
        label: "A: Goals & Objectives",
        weight: 0.4,
        n1: a_n1,
        n2: a_n2,
        weighted_n1: a_n1 != null ? a_n1 * 0.4 : null,
        weighted_n2: a_n2 != null ? a_n2 * 0.4 : null,
      },
      {
        label: "B: Core Competencies",
        weight: 0.3,
        n1: b_n1,
        n2: b_n2,
        weighted_n1: b_n1 != null ? b_n1 * 0.3 : null,
        weighted_n2: b_n2 != null ? b_n2 * 0.3 : null,
      },
      {
        label: "C: Leadership & Management",
        weight: 0.2,
        n1: c_n1,
        n2: c_n2,
        weighted_n1: c_n1 != null ? c_n1 * 0.2 : null,
        weighted_n2: c_n2 != null ? c_n2 * 0.2 : null,
      },
      {
        label: "D: Values & Culture",
        weight: 0.1,
        n1: d_n1,
        n2: d_n2,
        weighted_n1: d_n1 != null ? d_n1 * 0.1 : null,
        weighted_n2: d_n2 != null ? d_n2 * 0.1 : null,
      },
    ];
  }, [form]);

  const totalN1 = sections.reduce((s, r) => s + (r.weighted_n1 ?? 0), 0);
  const totalN2 = sections.reduce((s, r) => s + (r.weighted_n2 ?? 0), 0);
  const hasN1 = sections.some((s) => s.weighted_n1 != null);
  const hasN2 = sections.some((s) => s.weighted_n2 != null);

  function ratingLabel(score: number): string {
    const rounded = Math.round(score);
    return RATING_LABELS[rounded] ?? "—";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Overall Performance Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2">Section</th>
                <th className="pb-2 text-center">Weight</th>
                <th className="pb-2 text-center">N1 Score</th>
                <th className="pb-2 text-center">N2 Score</th>
                <th className="pb-2 text-center">Weighted (N1)</th>
                <th className="pb-2 text-center">Weighted (N2)</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.label} className="border-t border-border">
                  <td className="py-2 font-medium">{s.label}</td>
                  <td className="py-2 text-center text-muted-foreground">
                    {(s.weight * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 text-center">
                    {s.n1 != null ? s.n1.toFixed(2) : "—"}
                  </td>
                  <td className="py-2 text-center">
                    {s.n2 != null ? s.n2.toFixed(2) : "—"}
                  </td>
                  <td className="py-2 text-center font-medium">
                    {s.weighted_n1 != null ? s.weighted_n1.toFixed(2) : "—"}
                  </td>
                  <td className="py-2 text-center font-medium">
                    {s.weighted_n2 != null ? s.weighted_n2.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-foreground/20 font-semibold">
                <td className="py-2">TOTAL WEIGHTED SCORE</td>
                <td className="py-2 text-center">100%</td>
                <td colSpan={2} />
                <td className="py-2 text-center text-primary">
                  {hasN1 ? totalN1.toFixed(2) : "—"}
                </td>
                <td className="py-2 text-center text-primary">
                  {hasN2 ? totalN2.toFixed(2) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Overall label */}
        {(hasN1 || hasN2) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {hasN1 && (
              <div className="rounded-lg border border-border bg-accent/30 p-3 text-center">
                <div className="text-xs text-muted-foreground">Employee Self-Rating (N1)</div>
                <div className="mt-1 text-2xl font-bold">{totalN1.toFixed(2)}</div>
                <div className="mt-0.5 text-sm font-medium text-primary">
                  {ratingLabel(totalN1)}
                </div>
              </div>
            )}
            {hasN2 && (
              <div className="rounded-lg border border-border bg-accent/30 p-3 text-center">
                <div className="text-xs text-muted-foreground">Manager Rating (N2)</div>
                <div className="mt-1 text-2xl font-bold">{totalN2.toFixed(2)}</div>
                <div className="mt-0.5 text-sm font-medium text-primary">
                  {ratingLabel(totalN2)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
